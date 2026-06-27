from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import re
import httpx
import random
import hashlib
import os
import json
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cred_json = os.environ.get("FIREBASE_CREDENTIALS")
if cred_json:
    cred = credentials.Certificate(json.loads(cred_json))
else:
    cred = credentials.Certificate("serviceAccountKey.json")

firebase_admin.initialize_app(cred)
db = firestore.client()

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()

def normalizar(s: str) -> str:
    return unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode().lower().strip()

def is_ipora(municipio: str) -> bool:
    n = normalizar(municipio)
    return "ipora do oeste" in n or "ipor do oeste" in n

def enviar_sms(telefone: str, token: str):
    print(f"[SMS] Para {telefone}: Seu código é {token}")

def extrair_cnpj_direto(qr_code: str) -> str | None:
    print(f"[CNPJ] Tentando extrair de: {qr_code[:100]}")

    # NFS-e nacional: nfse.gov.br com parâmetro chave=
    # Formato da chave (50 dígitos): [7 cód.município][2 competência][14 CNPJ prestador][resto]
    # O CNPJ está na posição 9 a 22 da chave
    nfse_match = re.search(r'nfse\.gov\.br.*[?&]chave=\d{9}(\d{14})', qr_code)
    if nfse_match:
        print(f"[CNPJ] Encontrado via NFS-e nacional: {nfse_match.group(1)}")
        return nfse_match.group(1)

    # NFS-e municipal (vários formatos): chave= ou cnpj= na URL
    cnpj_param = re.search(r'[?&]cnpj=(\d{14})', qr_code, re.IGNORECASE)
    if cnpj_param:
        print(f"[CNPJ] Encontrado via param cnpj=: {cnpj_param.group(1)}")
        return cnpj_param.group(1)

    # NF-e produto: padrão p= com chave de acesso
    for pattern in [r'[?&]p=\d{6}(\d{14})', r'p=42\d{4}(\d{14})']:
        match = re.search(pattern, qr_code)
        if match:
            print(f"[CNPJ] Encontrado via NF-e p=: {match.group(1)}")
            return match.group(1)

    # Último recurso: 14 dígitos isolados (word boundary)
    match = re.search(r'(?<!\d)(\d{14})(?!\d)', qr_code)
    if match:
        print(f"[CNPJ] Encontrado via fallback 14 dígitos: {match.group(1)}")
        return match.group(1)

    print(f"[CNPJ] Nenhum padrão encontrado")
    return None

def is_nfse(qr_code: str) -> bool:
    return 'nfse.gov.br' in qr_code.lower()

def consultar_nfse(qr_code: str, cnpj: str) -> dict | None:
    """Consulta NFS-e nacional e tenta extrair razão social e município."""
    try:
        resposta = httpx.get(qr_code, timeout=30, follow_redirects=True)
        html = resposta.text
        print(f"HTML NFS-e (500 chars): {html[:500]}")

        razao = ""
        for p in [
            r'Prestador[^<]*<[^>]+>\s*([^<\n]{5,80})',
            r'Raz[aã]o Social[^:]*:\s*<[^>]+>\s*([^<\n]+)',
            r'Raz[aã]o Social[^:]*:\s*([^<\n]+)',
            r'Nome[^:]*:\s*<[^>]+>\s*([^<\n]+)',
        ]:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                razao = m.group(1).strip()
                if len(razao) > 3:
                    break

        municipio = ""
        for p in [
            r'Munic[íi]pio[^:]*:\s*<[^>]+>\s*([^<\n]+)',
            r'Munic[íi]pio[^:]*:\s*([^<\n]+)',
            r'Cidade[^:]*:\s*([^<\n]+)',
        ]:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                municipio = m.group(1).strip()
                if len(municipio) > 2:
                    break

        return {"cnpj": cnpj, "razao_social": razao or f"Prestador CNPJ {cnpj}", "municipio": municipio}
    except Exception as e:
        print(f"Erro NFS-e: {e}")
        return {"cnpj": cnpj, "razao_social": f"Prestador CNPJ {cnpj}", "municipio": ""}

def consultar_sef(qr_code: str) -> dict | None:
    try:
        resposta = httpx.get(qr_code, timeout=550, follow_redirects=True)
        html = resposta.text
        print(f"HTML SEF (500 chars): {html[:500]}")

        cnpj_match = re.search(r'(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', html)
        if not cnpj_match:
            return None

        cnpj = re.sub(r'\D', '', cnpj_match.group(1))
        razao = ""
        for p in [r'Raz[aã]o Social[^:]*:\s*<[^>]+>\s*([^<\n]+)', r'Raz[aã]o Social[^:]*:\s*([^<\n]+)']:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                razao = m.group(1).strip()
                break

        municipio = ""
        for p in [r'Munic[íi]pio[^:]*:\s*<[^>]+>\s*([^<\n]+)', r'Munic[íi]pio[^:]*:\s*([^<\n]+)']:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                municipio = m.group(1).strip()
                break

        return {"cnpj": cnpj, "razao_social": razao, "municipio": municipio}
    except Exception as e:
        print(f"Erro SEF: {e}")
    return None

# Cache simples para admins verificados (evita 1 consulta Firestore por request)
_admin_cache: dict[str, float] = {}
_ADMIN_CACHE_TTL = 300  # 5 minutos

def verificar_admin(cpf: str):
    agora = time.time()
    if cpf in _admin_cache and agora - _admin_cache[cpf] < _ADMIN_CACHE_TTL:
        return  # já verificado recentemente
    u = db.collection("usuarios").document(cpf).get()
    if not u.exists or u.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    _admin_cache[cpf] = agora

# ── Modelos ───────────────────────────────────────────────────────────────────

class NotaInput(BaseModel):
    qrCode: str
    cpfUsuario: str

class CadastroInput(BaseModel):
    nome: str
    cpf: str
    telefone: str
    senha: str

class LoginInput(BaseModel):
    cpf: str
    senha: str

class VerificarSmsInput(BaseModel):
    cpf: str
    token: str

class RedefinirSenhaInput(BaseModel):
    cpf: str
    token: str
    novaSenha: str

class ReenviarSmsInput(BaseModel):
    cpf: str

class EmpresaCSV(BaseModel):
    cnpj: str
    razaosocial: str
    nomefantasia: str
    situacao: str
    endereco: str
    numero: str
    bairro: str
    cep: str
    municipio: str
    ativa: bool

class ImportarEmpresasInput(BaseModel):
    cpfAdmin: str
    empresas: list[EmpresaCSV]
    modo: str = "inserir"

class SorteioInput(BaseModel):
    cpfAdmin: str
    tipo: str
    mes: int
    ano: int
    quantidade: int = 1
    lugar: int = 0

class ConfiguracaoSorteiosInput(BaseModel):
    cpfAdmin: str
    quantidadeSorteios: int

# ── Rotas ─────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "ok"}

@app.post("/cadastrar")
def cadastrar(dados: CadastroInput):
    ref = db.collection("usuarios").document(dados.cpf)
    existente = ref.get()
    token = str(random.randint(1000, 9999))

    if existente.exists:
        u = existente.to_dict()
        if u.get("verificado"):
            raise HTTPException(status_code=409, detail="CPF já cadastrado")
        ref.update({"nome": dados.nome, "telefone": dados.telefone, "senha": hash_senha(dados.senha), "tokenSms": token})
        enviar_sms(dados.telefone, token)
        return {"mensagem": "Código SMS reenviado"}

    ref.set({"cpf": dados.cpf, "nome": dados.nome, "telefone": dados.telefone,
             "senha": hash_senha(dados.senha), "verificado": False, "tokenSms": token,
             "perfil": "usuario", "dataCadastro": datetime.now()})
    enviar_sms(dados.telefone, token)
    return {"mensagem": "Código SMS enviado"}

@app.post("/verificar-sms")
def verificar_sms(dados: VerificarSmsInput):
    ref = db.collection("usuarios").document(dados.cpf).get()
    if not ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    u = ref.to_dict()
    if u.get("tokenSms", "") != dados.token:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")
    db.collection("usuarios").document(dados.cpf).update({"verificado": True, "tokenSms": ""})
    return {"mensagem": "Conta verificada!", "nome": u["nome"], "perfil": u.get("perfil", "usuario")}

@app.post("/reenviar-sms")
def reenviar_sms(dados: ReenviarSmsInput):
    ref = db.collection("usuarios").document(dados.cpf).get()
    if not ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    token = str(random.randint(1000, 9999))
    db.collection("usuarios").document(dados.cpf).update({"tokenSms": token})
    enviar_sms(ref.to_dict()["telefone"], token)
    return {"mensagem": "SMS reenviado"}

@app.post("/recuperar-senha")
def recuperar_senha(dados: ReenviarSmsInput):
    ref = db.collection("usuarios").document(dados.cpf).get()
    if not ref.exists:
        raise HTTPException(status_code=404, detail="CPF não cadastrado")
    token = str(random.randint(1000, 9999))
    db.collection("usuarios").document(dados.cpf).update({"tokenSms": token})
    enviar_sms(ref.to_dict()["telefone"], token)
    return {"mensagem": "Código enviado"}

@app.post("/redefinir-senha")
def redefinir_senha(dados: RedefinirSenhaInput):
    ref = db.collection("usuarios").document(dados.cpf).get()
    if not ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if ref.to_dict().get("tokenSms", "") != dados.token:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")
    db.collection("usuarios").document(dados.cpf).update({"senha": hash_senha(dados.novaSenha), "tokenSms": ""})
    return {"mensagem": "Senha redefinida com sucesso"}

@app.post("/login")
def login(dados: LoginInput):
    ref = db.collection("usuarios").document(dados.cpf).get()
    if not ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    u = ref.to_dict()
    if u["senha"] != hash_senha(dados.senha):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    if not u.get("verificado"):
        raise HTTPException(status_code=403, detail="Conta não verificada. Confirme o SMS.")
    return {"mensagem": "Login realizado", "nome": u["nome"], "perfil": u.get("perfil", "usuario")}

@app.get("/minhas-notas/{cpf}")
def minhas_notas(cpf: str):
    docs = db.collection("notas").where("cpfUsuario", "==", cpf).stream()
    resultado = [{"id": d.id, **d.to_dict()} for d in docs]
    resultado.sort(key=lambda x: x.get("registradoEm", ""), reverse=True)
    return resultado

@app.post("/validar-nota")
def validar_nota(dados: NotaInput):
    if not dados.qrCode:
        raise HTTPException(status_code=400, detail="QR Code não informado")
    try:
        # Usa transação atômica para evitar race condition de leituras simultâneas
        @firestore.transactional
        def _registrar(transaction, qr_code, cpf_usuario):
            # Verifica duplicata dentro da transação
            notas_dup = db.collection("notas").where("qrCode", "==", qr_code).limit(1).get(transaction=transaction)
            if len(list(notas_dup)) > 0:
                raise HTTPException(status_code=409, detail="Nota fiscal já registrada")

            usuario_ref = db.collection("usuarios").document(cpf_usuario)
            usuario_snap = usuario_ref.get(transaction=transaction)
            if not usuario_snap.exists:
                raise HTTPException(status_code=404, detail="Usuário não encontrado")

            return usuario_snap.to_dict()

        transaction = db.transaction()
        try:
            usuario = _registrar(transaction, dados.qrCode, dados.cpfUsuario)
        except HTTPException:
            raise

        cnpj = extrair_cnpj_direto(dados.qrCode)

        # Só faz consulta externa (lenta) se for NF-e de produto E o CNPJ não foi extraído
        if not cnpj and not is_nfse(dados.qrCode):
            sef = consultar_sef(dados.qrCode)
            if sef:
                cnpj = sef["cnpj"]

        if not cnpj:
            raise HTTPException(status_code=400, detail="Não foi possível identificar o CNPJ da nota")

        empresa_ref = db.collection("empresas").document(cnpj).get()
        if empresa_ref.exists:
            empresa = empresa_ref.to_dict()
            razao_social = empresa.get("razaosocial") or ""
            municipio = empresa.get("municipio") or empresa.get("município") or ""
        else:
            # Empresa não cadastrada — cadastra com o que tem, sem consulta externa bloqueante
            # O admin pode editar depois pelo painel
            razao_social = f"Empresa CNPJ {cnpj}"
            municipio = ""
            db.collection("empresas").document(cnpj).set({
                "cnpj": cnpj, "razaosocial": razao_social,
                "municipio": municipio, "ativa": False,
            })
            empresa = {"cnpj": cnpj, "razaosocial": razao_social, "municipio": municipio, "ativa": False}

        agora = datetime.now()

        if not empresa.get("ativa", False):
            raise HTTPException(status_code=403,
                detail=f"Nota de {razao_social} ({municipio or cnpj}) não gera cupons — apenas notas de Iporã do Oeste participam")

        # NFS-e (nota de serviço) gera 2 cupons, NF-e (produto) gera 1
        quantidade_cupons = 2 if is_nfse(dados.qrCode) else 1
        tipo_nota = "servico" if is_nfse(dados.qrCode) else "produto"
        cupons_gerados = [random.randint(100000, 999999) for _ in range(quantidade_cupons)]

        # Salva UMA única nota — a tela do app renderiza dois cards se tiver numeroCupom2
        nota = {
            "qrCode": dados.qrCode, "cnpj": cnpj, "razaoSocial": razao_social,
            "municipio": municipio, "cpfUsuario": dados.cpfUsuario,
            "nomeUsuario": usuario.get("nome", ""), "cupons": quantidade_cupons,
            "numeroCupom": cupons_gerados[0],
            "tipoNota": tipo_nota,
            "mes": agora.month, "ano": agora.year,
            "mesAno": f"{agora.month:02d}/{agora.year}", "registradoEm": agora,
        }
        if quantidade_cupons == 2:
            nota["numeroCupom2"] = cupons_gerados[1]

        db.collection("notas").add(nota)

        return {
            "razao_social": razao_social,
            "municipio": municipio,
            "cupons": quantidade_cupons,
            "tipoNota": tipo_nota,
            "numeroCupom": cupons_gerados[0],
            "numeroCupom2": cupons_gerados[1] if quantidade_cupons == 2 else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Admin ─────────────────────────────────────────────────────────────────────

@app.get("/admin/configuracao-sorteios")
def get_configuracao_sorteios(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    doc = db.collection("configuracoes").document("sorteios").get()
    if doc.exists:
        return doc.to_dict()
    return {"quantidadeSorteios": 10}

@app.put("/admin/configuracao-sorteios")
@app.post("/admin/salvar-configuracao-sorteios")
def put_configuracao_sorteios(dados: ConfiguracaoSorteiosInput):
    verificar_admin(dados.cpfAdmin)
    if not (1 <= dados.quantidadeSorteios <= 20):
        raise HTTPException(status_code=400, detail="Quantidade deve ser entre 1 e 20")
    db.collection("configuracoes").document("sorteios").set({"quantidadeSorteios": dados.quantidadeSorteios})
    return {"mensagem": "Configuração salva", "quantidadeSorteios": dados.quantidadeSorteios}

@app.get("/admin/stats")
def admin_stats(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    agora = datetime.now()

    # Executa as 3 consultas em paralelo
    def _notas():
        return [d.to_dict() for d in db.collection("notas").stream()]
    def _usuarios():
        return len(list(db.collection("usuarios").select(["cpf"]).stream()))
    def _empresas():
        return len(list(db.collection("empresas").select(["cnpj"]).stream()))

    with ThreadPoolExecutor(max_workers=3) as ex:
        f_notas    = ex.submit(_notas)
        f_usuarios = ex.submit(_usuarios)
        f_empresas = ex.submit(_empresas)
        todas_notas    = f_notas.result()
        total_usuarios = f_usuarios.result()
        total_empresas = f_empresas.result()

    notas_mes = [n for n in todas_notas if n.get("mes") == agora.month and n.get("ano") == agora.year]
    return {
        "totalUsuarios": total_usuarios,
        "totalEmpresas": total_empresas,
        "totalNotas": len(todas_notas),
        "totalCupons": sum(n.get("cupons", 0) for n in todas_notas),
        "notasMes": len(notas_mes),
        "cupomsMes": sum(n.get("cupons", 0) for n in notas_mes),
    }

@app.get("/admin/empresas")
def admin_empresas(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    return [{"id": d.id, **d.to_dict()} for d in db.collection("empresas").stream()]

class EmpresaManualInput(BaseModel):
    cpfAdmin: str
    cnpj: str
    razaosocial: str
    nomefantasia: str = ""
    situacao: str = "ATIVA"
    endereco: str = ""
    bairro: str = ""
    cep: str = ""
    municipio: str = ""
    ativa: bool = True

@app.post("/admin/empresa")
def criar_empresa(dados: EmpresaManualInput):
    verificar_admin(dados.cpfAdmin)
    cnpj = re.sub(r"\D", "", dados.cnpj).zfill(14)
    if len(cnpj) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido")
    ref = db.collection("empresas").document(cnpj)
    ref.set({
        "cnpj": cnpj,
        "razaosocial": dados.razaosocial,
        "nomefantasia": dados.nomefantasia,
        "situacao": dados.situacao,
        "endereco": dados.endereco,
        "bairro": dados.bairro,
        "cep": dados.cep,
        "municipio": dados.municipio,
        "ativa": dados.ativa,
    })
    return {"mensagem": "Empresa salva com sucesso", "cnpj": cnpj}

@app.put("/admin/empresa/{cnpj}")
def editar_empresa(cnpj: str, dados: EmpresaManualInput):
    verificar_admin(dados.cpfAdmin)
    cnpj_limpo = re.sub(r"\D", "", cnpj).zfill(14)
    ref = db.collection("empresas").document(cnpj_limpo)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    ref.update({
        "razaosocial": dados.razaosocial,
        "nomefantasia": dados.nomefantasia,
        "situacao": dados.situacao,
        "endereco": dados.endereco,
        "bairro": dados.bairro,
        "cep": dados.cep,
        "municipio": dados.municipio,
        "ativa": dados.ativa,
    })
    return {"mensagem": "Empresa atualizada com sucesso", "cnpj": cnpj_limpo}

@app.delete("/admin/empresa/{cnpj}")
def deletar_empresa(cnpj: str, cpfAdmin: str):
    verificar_admin(cpfAdmin)
    cnpj_limpo = re.sub(r"\D", "", cnpj).zfill(14)
    ref = db.collection("empresas").document(cnpj_limpo)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    ref.delete()
    return {"mensagem": "Empresa removida"}

@app.get("/admin/usuarios")
def admin_usuarios(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    resultado = []
    for d in db.collection("usuarios").stream():
        u = d.to_dict()
        u.pop("senha", None)
        u.pop("tokenSms", None)
        resultado.append(u)
    return resultado

@app.get("/admin/cupons")
def admin_cupons(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    docs = [{"id": d.id, **d.to_dict()} for d in db.collection("notas").stream()]
    docs.sort(key=lambda x: x.get("registradoEm", ""), reverse=True)
    return docs

@app.post("/admin/importar-empresas")
def importar_empresas(dados: ImportarEmpresasInput):
    verificar_admin(dados.cpfAdmin)

    resultados = []
    batch = db.batch()
    batch_count = 0

    # Carrega CNPJs existentes para verificar duplicatas no modo "inserir"
    cnpjs_existentes = {d.id for d in db.collection("empresas").stream()}

    for e in dados.empresas:
        try:
            cnpj = re.sub(r"\D", "", e.cnpj or "").zfill(14)

            if len(cnpj) != 14:
                resultados.append({
                    "cnpj": e.cnpj,
                    "razaosocial": e.razaosocial,
                    "status": "ignorado"
                })
                continue

            ref = db.collection("empresas").document(cnpj)

            if dados.modo == "inserir" and cnpj in cnpjs_existentes:
                resultados.append({
                    "cnpj": cnpj,
                    "razaosocial": e.razaosocial,
                    "status": "ignorado"
                })
                continue

            batch.set(ref, {
                "cnpj": cnpj,
                "razaosocial": e.razaosocial,
                "nomefantasia": e.nomefantasia,
                "situacao": e.situacao,
                "endereco": f"{e.endereco}, {e.numero}",
                "bairro": e.bairro,
                "cep": e.cep,
                "municipio": e.municipio,
                "ativa": e.ativa,
            })
            batch_count += 1

            resultados.append({
                "cnpj": cnpj,
                "razaosocial": e.razaosocial,
                "status": "importado"
            })

            if batch_count >= 400:
                print(f"Commit lote de {batch_count} registros")
                batch.commit()
                batch = db.batch()
                batch_count = 0

        except Exception as ex:
            print(f"ERRO CNPJ {e.cnpj}: {str(ex)}")
            resultados.append({
                "cnpj": e.cnpj,
                "razaosocial": e.razaosocial,
                "status": "erro",
                "mensagem": str(ex)
            })

    if batch_count > 0:
        print(f"Commit final de {batch_count} registros")
        batch.commit()
    return {"resultados": resultados}

@app.post("/admin/corrigir-municipio")
def corrigir_municipio(dados: ReenviarSmsInput):
    verificar_admin(dados.cpf)
    corrigidas = 0
    for d in db.collection("empresas").stream():
        empresa = d.to_dict()
        municipio = empresa.get("municipio", "")
        n = normalizar(municipio)
        if ("ipora do oeste" in n or "ipor do oeste" in n) and municipio != "Iporã do Oeste - SC":
            d.reference.update({"municipio": "Iporã do Oeste - SC"})
            corrigidas += 1
    return {"mensagem": f"{corrigidas} empresas corrigidas"}

@app.post("/admin/corrigir-notas")
def corrigir_notas(dados: ReenviarSmsInput):
    verificar_admin(dados.cpf)
    corrigidas = 0
    for d in db.collection("notas").stream():
        nota = d.to_dict()
        if nota.get("mes") and nota.get("ano"):
            continue
        reg = nota.get("registradoEm")
        if reg:
            data = datetime.fromtimestamp(reg.seconds) if hasattr(reg, 'seconds') else datetime.fromisoformat(str(reg))
        else:
            data = datetime.now()
        d.reference.update({"mes": data.month, "ano": data.year, "mesAno": f"{data.month:02d}/{data.year}"})
        corrigidas += 1
    return {"mensagem": f"{corrigidas} notas corrigidas"}

@app.post("/admin/corrigir-nfse-duplicadas")
def corrigir_nfse_duplicadas(dados: ReenviarSmsInput):
    """
    Remove notas duplicadas geradas pelo código antigo que salvava duas notas
    para NFS-e. Identifica notas com qrCode terminando em '#cupom2', pega o
    numeroCupom delas, migra para a nota original como numeroCupom2, e deleta
    a duplicata.
    """
    verificar_admin(dados.cpf)
    removidas = 0
    migradas = 0

    todas = list(db.collection("notas").stream())

    for d in todas:
        nota = d.to_dict()
        qr = nota.get("qrCode", "")
        if not qr.endswith("#cupom2"):
            continue

        # qrCode original é sem o sufixo
        qr_original = qr[:-7]  # remove "#cupom2"
        num_cupom2 = nota.get("numeroCupom")

        # Busca a nota original pelo qrCode
        originais = db.collection("notas").where("qrCode", "==", qr_original).limit(1).get()
        for orig in originais:
            orig.reference.update({
                "numeroCupom2": num_cupom2,
                "tipoNota": "servico",
                "cupons": 2,
            })
            migradas += 1

        # Deleta a nota duplicada
        d.reference.delete()
        removidas += 1

    return {"mensagem": f"{removidas} duplicatas removidas, {migradas} notas originais atualizadas"}

@app.post("/admin/sortear")
def sortear(dados: SorteioInput):
    verificar_admin(dados.cpfAdmin)

    # Busca notas e sorteios em paralelo
    def _notas():
        return [d.to_dict() for d in db.collection("notas").stream()]
    def _sorteios():
        return [{"id": s.id, **s.to_dict()} for s in db.collection("sorteios").stream()]

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_notas    = ex.submit(_notas)
        f_sorteios = ex.submit(_sorteios)
        notas    = f_notas.result()
        todos_sorteios = f_sorteios.result()

    if dados.tipo == "mensal":
        participantes = [n for n in notas if n.get("cupons", 0) > 0 and n.get("mes") == dados.mes and n.get("ano") == dados.ano]
    else:
        participantes = [n for n in notas if n.get("cupons", 0) > 0 and n.get("ano") == dados.ano]

    if not participantes:
        raise HTTPException(status_code=404, detail="Nenhum cupom encontrado para o período")

    sorteios_periodo = []
    for sd in todos_sorteios:
        if sd.get("tipo") != dados.tipo or sd.get("ano") != dados.ano:
            continue
        if dados.tipo == "mensal" and sd.get("mes") != dados.mes:
            continue
        sorteios_periodo.append(sd)

    cupons_ja_sorteados = {s.get("numeroCupom") for s in sorteios_periodo}
    lugar = dados.lugar if dados.lugar > 0 else len(sorteios_periodo) + 1

    if any(s.get("posicao") == lugar for s in sorteios_periodo):
        raise HTTPException(status_code=409, detail=f"{lugar}º lugar já foi sorteado neste período")

    # Expande as notas: NFS-e com numeroCupom2 entra com dois cupons no pool
    pool = []
    for n in participantes:
        pool.append({**n, "_cupomSorteio": n.get("numeroCupom")})
        if n.get("numeroCupom2"):
            pool.append({**n, "_cupomSorteio": n.get("numeroCupom2")})

    disponiveis = [c for c in pool if c.get("_cupomSorteio") not in cupons_ja_sorteados]
    if not disponiveis:
        raise HTTPException(status_code=404, detail="Todos os cupons já foram sorteados neste período")

    agora = datetime.now()
    ganhadores = []
    for i, g in enumerate(random.sample(disponiveis, min(dados.quantidade, len(disponiveis)))):
        ganhador = {
            "numeroCupom": g.get("_cupomSorteio"), "nomeUsuario": g.get("nomeUsuario"),
            "cpfUsuario": g.get("cpfUsuario"), "razaoSocial": g.get("razaoSocial"),
            "mesAno": g.get("mesAno"), "tipo": dados.tipo, "mes": dados.mes,
            "ano": dados.ano, "posicao": lugar + i, "realizadoEm": agora.isoformat(),
            "tipoNota": g.get("tipoNota", "produto"),
        }
        db.collection("sorteios").add(ganhador)
        ganhadores.append(ganhador)

    return {"ganhadores": ganhadores, "proximaPosicao": lugar + len(ganhadores)}

@app.get("/admin/historico-sorteios")
def historico_sorteios(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    resultado = [{"id": d.id, **d.to_dict()} for d in db.collection("sorteios").stream()]
    resultado.sort(key=lambda x: x.get("realizadoEm", ""), reverse=True)
    return resultado

class PublicarResultadoInput(BaseModel):
    cpfAdmin: str
    tipo: str = "mensal"   # "mensal" ou "anual"
    mes: int | None = None
    ano: int | None = None
    publicar: bool = True

@app.post("/admin/publicar-resultado")
def publicar_resultado(dados: PublicarResultadoInput):
    """Publica ou despublica resultados de um período específico."""
    verificar_admin(dados.cpfAdmin)
    agora = datetime.now()
    mes = dados.mes or agora.month
    ano = dados.ano or agora.year

    atualizados = 0
    for d in db.collection("sorteios").stream():
        s = d.to_dict()
        if s.get("tipo") != dados.tipo or s.get("ano") != ano:
            continue
        if dados.tipo == "mensal" and s.get("mes") != mes:
            continue
        d.reference.update({"publicado": dados.publicar})
        atualizados += 1

    periodo = f"Anual {ano}" if dados.tipo == "anual" else f"{mes:02d}/{ano}"
    acao = "publicados" if dados.publicar else "ocultados"
    return {"mensagem": f"{atualizados} sorteios {acao} — {periodo}"}

@app.get("/resultados-publicos")
def resultados_publicos():
    """Retorna apenas sorteios marcados como publicados — sem autenticação."""
    docs = db.collection("sorteios").where("publicado", "==", True).stream()
    resultado = []
    for d in docs:
        s = {"id": d.id, **d.to_dict()}
        # Remove dados sensíveis — mostra só o necessário
        resultado.append({
            "id": s["id"],
            "numeroCupom": s.get("numeroCupom"),
            "nomeUsuario": s.get("nomeUsuario", ""),
            "razaoSocial": s.get("razaoSocial", ""),
            "mesAno": s.get("mesAno", ""),
            "tipo": s.get("tipo", ""),
            "mes": s.get("mes"),
            "ano": s.get("ano"),
            "posicao": s.get("posicao"),
            "tipoNota": s.get("tipoNota", "produto"),
            "realizadoEm": s.get("realizadoEm", ""),
        })
    resultado.sort(key=lambda x: (x.get("ano", 0), x.get("mes", 0), x.get("posicao", 0)))
    return resultado

@app.delete("/admin/empresas")
def deletar_todas_empresas(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("empresas").stream()
    count = 0
    for d in docs:
        d.reference.delete()
        count += 1
    return {"mensagem": f"{count} empresas removidas"}

@app.delete("/admin/sorteio/{sorteio_id}")
def deletar_sorteio(sorteio_id: str, cpfAdmin: str):
    verificar_admin(cpfAdmin)
    db.collection("sorteios").document(sorteio_id).delete()
    return {"mensagem": "Sorteio removido"}

@app.delete("/admin/sorteios")
def deletar_todos_sorteios(cpfAdmin: str):
    verificar_admin(cpfAdmin)
    for d in db.collection("sorteios").stream():
        d.reference.delete()
    return {"mensagem": "Todos os sorteios removidos"}
