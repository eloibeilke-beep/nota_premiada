from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import re
import httpx
import random
import hashlib

app = FastAPI()

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

MUNICIPIO_ALVO = "iporã do oeste"

# ── Modelos ──────────────────────────────────────────────

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
    senha: str
    cpfAdmin: str
    empresas: list[EmpresaCSV]
    modo: str = "inserir"

# ── Helpers ──────────────────────────────────────────────

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()

def enviar_sms(telefone: str, token: str):
    # TODO: integrar com provedor SMS real (ex: Twilio, Zenvia, AWS SNS)
    # Por enquanto imprime no terminal para teste
    print(f"[SMS] Para {telefone}: Seu código é {token}")

def extrair_cnpj_direto(qr_code: str) -> str | None:
    # Formato SC: ...?p=CUFAAMM[CNPJ14]...
    match = re.search(r'[?&]p=\d{2}\d{4}(\d{14})', qr_code)
    if match:
        return match.group(1)
    # Formato SC novo: ...?p=42AAMM[CNPJ14]NNN...|...
    match = re.search(r'p=42\d{4}(\d{14})', qr_code)
    if match:
        return match.group(1)
    # CNPJ solto na string
    match = re.search(r'\b(\d{14})\b', qr_code)
    if match:
        return match.group(1)
    return None

def consultar_sef(qr_code: str) -> dict | None:
    try:
        resposta = httpx.get(qr_code, timeout=15, follow_redirects=True)
        html = resposta.text
        print(f"HTML SEF (500 chars): {html[:500]}")

        cnpj_match = re.search(r'(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})', html)
        if not cnpj_match:
            print("CNPJ não encontrado no HTML")
            return None

        cnpj = re.sub(r'\D', '', cnpj_match.group(1))

        # Tenta extrair razão social
        razao = ""
        for pattern in [
            r'Raz[aã]o Social[^:]*:\s*<[^>]+>\s*([^<\n]+)',
            r'Raz[aã]o Social[^:]*:\s*([^<\n]+)',
            r'<span[^>]*>([^<]{5,60})</span>\s*<br',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                razao = m.group(1).strip()
                break

        # Tenta extrair município
        municipio = ""
        for pattern in [
            r'Munic[íi]pio[^:]*:\s*<[^>]+>\s*([^<\n]+)',
            r'Munic[íi]pio[^:]*:\s*([^<\n]+)',
            r'Endere[çc]o[^:]*:\s*[^<]*,\s*([A-Za-zÀ-ú\s]+)\s*[-–]?\s*SC',
        ]:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                municipio = m.group(1).strip()
                break

        print(f"SEF -> CNPJ: {cnpj} | Razão: {razao} | Município: {municipio}")
        return {"cnpj": cnpj, "razao_social": razao, "municipio": municipio}

    except Exception as e:
        print(f"Erro ao consultar SEF: {e}")
    return None

def is_ipora(municipio: str) -> bool:
    return MUNICIPIO_ALVO in municipio.lower().strip()

@app.get("/")
def home():
    return {"status": "ok"}

# ── Auth ────────────────────────────────────────────────

@app.post("/cadastrar")
def cadastrar(dados: CadastroInput):
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()

    if usuario_ref.exists:
        usuario = usuario_ref.to_dict()
        if usuario.get("verificado"):
            raise HTTPException(status_code=409, detail="CPF já cadastrado")
        # Não verificado: reenvia SMS e atualiza dados
        token = str(random.randint(1000, 9999))
        db.collection("usuarios").document(dados.cpf).update({
            "nome": dados.nome,
            "telefone": dados.telefone,
            "senha": hash_senha(dados.senha),
            "tokenSms": token,
        })
        enviar_sms(dados.telefone, token)
        return {"mensagem": "Código SMS reenviado"}

    token = str(random.randint(1000, 9999))
    db.collection("usuarios").document(dados.cpf).set({
        "cpf": dados.cpf,
        "nome": dados.nome,
        "telefone": dados.telefone,
        "senha": hash_senha(dados.senha),
        "verificado": False,
        "tokenSms": token,
        "perfil": "usuario",
        "dataCadastro": datetime.now(),
    })
    enviar_sms(dados.telefone, token)
    return {"mensagem": "Código SMS enviado"}

@app.post("/verificar-sms")
def verificar_sms(dados: VerificarSmsInput):
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    usuario = usuario_ref.to_dict()
    token_esperado = usuario.get("tokenSms", "")

    if not token_esperado or token_esperado != dados.token:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    db.collection("usuarios").document(dados.cpf).update({
        "verificado": True,
        "tokenSms": "",
    })

    return {"mensagem": "Conta verificada!", "nome": usuario["nome"], "perfil": usuario.get("perfil", "usuario")}

@app.post("/reenviar-sms")
def reenviar_sms(dados: ReenviarSmsInput):
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    token = str(random.randint(1000, 9999))
    usuario = usuario_ref.to_dict()

    db.collection("usuarios").document(dados.cpf).update({"tokenSms": token})
    enviar_sms(usuario["telefone"], token)
    return {"mensagem": "SMS reenviado"}

@app.post("/recuperar-senha")
def recuperar_senha(dados: ReenviarSmsInput):
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=404, detail="CPF não cadastrado")
    token = str(random.randint(1000, 9999))
    db.collection("usuarios").document(dados.cpf).update({"tokenSms": token})
    enviar_sms(usuario_ref.to_dict()["telefone"], token)
    return {"mensagem": "Código enviado"}

@app.post("/redefinir-senha")
def redefinir_senha(dados: RedefinirSenhaInput):
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    usuario = usuario_ref.to_dict()
    if usuario.get("tokenSms", "") != dados.token:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")
    db.collection("usuarios").document(dados.cpf).update({
        "senha": hash_senha(dados.novaSenha),
        "tokenSms": "",
    })
    return {"mensagem": "Senha redefinida com sucesso"}

@app.get("/admin/stats")
def admin_stats(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    agora = datetime.now()
    usuarios = list(db.collection("usuarios").stream())
    empresas = list(db.collection("empresas").stream())
    notas = [d.to_dict() for d in db.collection("notas").stream()]

    notas_mes = [n for n in notas if n.get("mes") == agora.month and n.get("ano") == agora.year]

    return {
        "totalUsuarios": len(usuarios),
        "totalEmpresas": len(empresas),
        "totalNotas": len(notas),
        "totalCupons": sum(n.get("cupons", 0) for n in notas),
        "notasMes": len(notas_mes),
        "cupomsMes": sum(n.get("cupons", 0) for n in notas_mes),
    }

@app.get("/admin/empresas")
def admin_empresas(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("empresas").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

@app.get("/admin/usuarios")
def admin_usuarios(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("usuarios").stream()
    resultado = []
    for d in docs:
        u = d.to_dict()
        u.pop("senha", None)
        u.pop("tokenSms", None)
        resultado.append(u)
    return resultado

@app.get("/admin/cupons")
def admin_cupons(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("notas").stream()
    resultado = [{"id": d.id, **d.to_dict()} for d in docs]
    resultado.sort(key=lambda x: x.get("registradoEm", ""), reverse=True)
    return resultado

class SorteioInput(BaseModel):
    cpfAdmin: str
    tipo: str
    mes: int
    ano: int
    quantidade: int = 1
    lugar: int = 0  # 0 = próximo automático

@app.post("/admin/corrigir-notas")
def corrigir_notas(dados: ReenviarSmsInput):
    usuario = db.collection("usuarios").document(dados.cpf).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    docs = db.collection("notas").stream()
    corrigidas = 0
    for d in docs:
        nota = d.to_dict()
        if nota.get("mes") and nota.get("ano"):
            continue
        registrado = nota.get("registradoEm")
        if registrado:
            if hasattr(registrado, 'seconds'):
                data = datetime.fromtimestamp(registrado.seconds)
            else:
                try:
                    data = datetime.fromisoformat(str(registrado))
                except:
                    data = datetime.now()
        else:
            data = datetime.now()

        d.reference.update({
            "mes": data.month,
            "ano": data.year,
            "mesAno": f"{data.month:02d}/{data.year}",
        })
        corrigidas += 1

    return {"mensagem": f"{corrigidas} notas corrigidas"}

@app.post("/admin/sortear")
def sortear(dados: SorteioInput):
    usuario = db.collection("usuarios").document(dados.cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    notas = [d.to_dict() for d in db.collection("notas").stream()]
    print(f"Total notas: {len(notas)}")
    print(f"Exemplo nota: {notas[0] if notas else 'vazio'}")

    if dados.tipo == "mensal":
        participantes = [n for n in notas if n.get("cupons", 0) > 0 and n.get("mes") == dados.mes and n.get("ano") == dados.ano]
    else:
        participantes = [n for n in notas if n.get("cupons", 0) > 0 and n.get("ano") == dados.ano]

    print(f"Participantes encontrados: {len(participantes)}")

    if not participantes:
        raise HTTPException(status_code=404, detail="Nenhum cupom encontrado para o período")

    # Busca cupons já sorteados neste período
    sorteios_docs = db.collection("sorteios").get()
    sorteios_periodo = []
    for s in sorteios_docs:
        sd = s.to_dict()
        if sd.get("tipo") != dados.tipo or sd.get("ano") != dados.ano:
            continue
        if dados.tipo == "mensal" and sd.get("mes") != dados.mes:
            continue
        sorteios_periodo.append(sd)

    print(f"Já sorteados neste período: {len(sorteios_periodo)}")

    cupons_ja_sorteados = {s.get("numeroCupom") for s in sorteios_periodo}

    # Se lugar específico solicitado, verifica se já foi sorteado
    lugar = dados.lugar if dados.lugar > 0 else proxima_posicao
    ja_sorteado_lugar = any(s.get("posicao") == lugar for s in sorteios_periodo)
    if ja_sorteado_lugar:
        raise HTTPException(status_code=409, detail=f"{lugar}º lugar já foi sorteado neste período")

    proxima_posicao = lugar

    disponiveis = [n for n in participantes if n.get("numeroCupom") not in cupons_ja_sorteados]
    print(f"Disponíveis para sortear: {len(disponiveis)}")

    if not disponiveis:
        raise HTTPException(status_code=404, detail="Todos os cupons já foram sorteados neste período")

    quantidade = min(dados.quantidade, len(disponiveis))
    selecionados = random.sample(disponiveis, quantidade)
    agora = datetime.now()
    ganhadores = []

    for i, g in enumerate(selecionados):
        ganhador = {
            "numeroCupom": g.get("numeroCupom"),
            "nomeUsuario": g.get("nomeUsuario"),
            "cpfUsuario": g.get("cpfUsuario"),
            "razaoSocial": g.get("razaoSocial"),
            "mesAno": g.get("mesAno"),
            "tipo": dados.tipo,
            "mes": dados.mes,
            "ano": dados.ano,
            "posicao": proxima_posicao + i,
            "realizadoEm": agora.isoformat(),
        }
        db.collection("sorteios").add(ganhador)
        ganhadores.append(ganhador)

    return {"ganhadores": ganhadores, "proximaPosicao": proxima_posicao + quantidade}

@app.delete("/admin/sorteio/{sorteio_id}")
def deletar_sorteio(sorteio_id: str, cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    db.collection("sorteios").document(sorteio_id).delete()
    return {"mensagem": "Sorteio removido"}

@app.delete("/admin/sorteios")
def deletar_todos_sorteios(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("sorteios").stream()
    for d in docs:
        d.reference.delete()
    return {"mensagem": "Todos os sorteios removidos"}

@app.get("/admin/historico-sorteios")
def historico_sorteios(cpfAdmin: str):
    usuario = db.collection("usuarios").document(cpfAdmin).get()
    if not usuario.exists or usuario.to_dict().get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    docs = db.collection("sorteios").stream()
    resultado = [{"id": d.id, **d.to_dict()} for d in docs]
    resultado.sort(key=lambda x: x.get("realizadoEm", ""), reverse=True)
    return resultado

@app.post("/admin/importar-empresas")
def importar_empresas(dados: ImportarEmpresasInput):
    # Verifica se o usuário é admin no Firestore
    usuario_ref = db.collection("usuarios").document(dados.cpfAdmin).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    usuario = usuario_ref.to_dict()
    if usuario.get("perfil") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")

    resultados = []
    for e in dados.empresas:
        try:
            ref = db.collection("empresas").document(e.cnpj)
            existe = ref.get().exists

            if existe and dados.modo == "inserir":
                resultados.append({"cnpj": e.cnpj, "razaosocial": e.razaosocial, "status": "ignorado"})
                continue

            ref.set({
                "cnpj": e.cnpj,
                "razaosocial": e.razaosocial,
                "nomefantasia": e.nomefantasia,
                "situacao": e.situacao,
                "endereco": f"{e.endereco}, {e.numero}",
                "bairro": e.bairro,
                "cep": e.cep,
                "munic\u00edpio": e.municipio,
                "ativa": e.ativa,
            })
            resultados.append({
                "cnpj": e.cnpj,
                "razaosocial": e.razaosocial,
                "status": "atualizado" if existe else "importado",
            })
        except Exception as ex:
            resultados.append({
                "cnpj": e.cnpj,
                "razaosocial": e.razaosocial,
                "status": "erro",
                "mensagem": str(ex),
            })

    print(f"Import\u00e1veis: {len([r for r in resultados if r['status'] != 'erro'])} | Erros: {len([r for r in resultados if r['status'] == 'erro'])}")
    return {"resultados": resultados}


@app.post("/login")
def login(dados: LoginInput):
    print(f"Login: cpf={dados.cpf}")
    usuario_ref = db.collection("usuarios").document(dados.cpf).get()
    if not usuario_ref.exists:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    usuario = usuario_ref.to_dict()
    print(f"verificado={usuario.get('verificado')} perfil={usuario.get('perfil')}")

    if usuario["senha"] != hash_senha(dados.senha):
        raise HTTPException(status_code=401, detail="Senha incorreta")

    if not usuario.get("verificado"):
        raise HTTPException(status_code=403, detail="Conta não verificada. Confirme o SMS.")

    return {"mensagem": "Login realizado", "nome": usuario["nome"], "perfil": usuario.get("perfil", "usuario")}

@app.get("/minhas-notas/{cpf}")
def minhas_notas(cpf: str):
    docs = db.collection("notas") \
        .where("cpfUsuario", "==", cpf) \
        .stream()
    resultado = [{"id": d.id, **d.to_dict()} for d in docs]
    resultado.sort(key=lambda x: x.get("registradoEm", ""), reverse=True)
    return resultado

@app.get("/notas")
def listar_notas():
    docs = db.collection("notas").order_by("registradoEm", direction=firestore.Query.DESCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

@app.post("/validar-nota")
def validar_nota(dados: NotaInput):
    if not dados.qrCode:
        raise HTTPException(status_code=400, detail="QR Code não informado")

    try:
        # Impede nota duplicada
        existente = db.collection("notas").where("qrCode", "==", dados.qrCode).get()
        if existente:
            raise HTTPException(status_code=409, detail="Nota fiscal já registrada")

        # Busca usuário
        usuario_ref = db.collection("usuarios").document(dados.cpfUsuario).get()
        if not usuario_ref.exists:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        usuario = usuario_ref.to_dict()

        # Tenta extrair CNPJ direto da URL
        cnpj = extrair_cnpj_direto(dados.qrCode)
        sef = None

        # Se não achou, consulta SEF-SC
        if not cnpj:
            sef = consultar_sef(dados.qrCode)
            if sef:
                cnpj = sef["cnpj"]

        if not cnpj:
            raise HTTPException(status_code=400, detail="Não foi possível identificar o CNPJ da nota")

        # Verifica se empresa já está no Firestore
        empresa_ref = db.collection("empresas").document(cnpj).get()

        if empresa_ref.exists:
            empresa = empresa_ref.to_dict()
            razao_social = empresa.get("razaosocial") or empresa.get("razaoSocial") or ""
            municipio = empresa.get("município") or empresa.get("municipio") or ""
        else:
            # Empresa não cadastrada — consulta SEF se ainda não consultou
            if not sef:
                sef = consultar_sef(dados.qrCode)

            if not sef or not sef.get("razao_social"):
                raise HTTPException(status_code=404, detail=f"Empresa {cnpj} não encontrada na SEF-SC")

            razao_social = sef["razao_social"]
            municipio = sef["municipio"]

            # Registra empresa no Firestore
            db.collection("empresas").document(cnpj).set({
                "cnpj": cnpj,
                "razaosocial": razao_social,
                "município": municipio,
                "ativa": is_ipora(municipio),
            })
            print(f"Empresa registrada: {razao_social} | {municipio} | ativa={is_ipora(municipio)}")

            empresa = db.collection("empresas").document(cnpj).get().to_dict()

        # Verifica se empresa está ativa (é de Iporã do Oeste)
        if not empresa.get("ativa"):
            # Salva nota sem cupom
            db.collection("notas").add({
                "qrCode": dados.qrCode,
                "cnpj": cnpj,
                "razaoSocial": razao_social,
                "municipio": municipio,
                "cpfUsuario": dados.cpfUsuario,
                "nomeUsuario": usuario.get("nome", ""),
                "cupons": 0,
                "mes": datetime.now().month,
                "ano": datetime.now().year,
                "mesAno": f"{datetime.now().month:02d}/{datetime.now().year}",
                "registradoEm": datetime.now(),
            })
            raise HTTPException(
                status_code=403,
                detail=f"Nota de {razao_social} ({municipio}) não gera cupons — apenas notas de Iporã do Oeste participam"
            )

        cupons = 1
        numero_cupom = random.randint(100000, 999999)
        agora = datetime.now()

        # Salva nota com cupom
        db.collection("notas").add({
            "qrCode": dados.qrCode,
            "cnpj": cnpj,
            "razaoSocial": razao_social,
            "municipio": municipio,
            "cpfUsuario": dados.cpfUsuario,
            "nomeUsuario": usuario.get("nome", ""),
            "cupons": cupons,
            "numeroCupom": numero_cupom,
            "mes": agora.month,
            "ano": agora.year,
            "mesAno": f"{agora.month:02d}/{agora.year}",
            "registradoEm": agora,
        })

        print(f"Nota salva! {razao_social} | {municipio} | cupom #{numero_cupom}")

        return {
            "razao_social": razao_social,
            "municipio": municipio,
            "cupons": cupons,
            "numeroCupom": numero_cupom,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO: {e}")
        raise HTTPException(status_code=500, detail=str(e))
