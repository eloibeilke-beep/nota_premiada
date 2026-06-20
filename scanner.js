import { CameraView } from 'expo-camera';

<CameraView
   barcodeScannerSettings={{
      barcodeTypes: ["qr"]
   }}
   onBarcodeScanned={(result)=>{
      console.log(result.data);
   }}
/>