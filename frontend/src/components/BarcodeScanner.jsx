import React, { useState, useRef, useCallback } from 'react';
import { Camera, StopCircle, History, Scan, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { simulateScan } from '../mock/mockData';
import { useToast } from '../hooks/use-toast';

const BarcodeScanner = ({ onScanComplete }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const { toast } = useToast();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        toast({
          title: "Kamera başlatıldı",
          description: "Barkodu kameranın önüne getirin",
        });
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Kamera hatası",
        description: "Kamera erişimi reddedildi veya kamera bulunamadı",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      setIsScanning(false);
    }
  }, []);

  const startScan = useCallback(async () => {
    if (!cameraActive) {
      await startCamera();
    }
    
    setIsScanning(true);
    setScanResult(null);
    
    try {
      // Using mock scan for now
      const result = await simulateScan();
      setScanResult(result);
      setIsScanning(false);
      
      if (onScanComplete) {
        onScanComplete(result);
      }
      
      toast({
        title: "Barkod başarıyla okundu!",
        description: `${result.type}: ${result.barcode}`,
      });
    } catch (error) {
      setIsScanning(false);
      toast({
        title: "Tarama hatası",
        description: "Barkod okunamadı, tekrar deneyin",
        variant: "destructive"
      });
    }
  }, [cameraActive, startCamera, onScanComplete, toast]);

  const resetScan = () => {
    setScanResult(null);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Camera View */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scan className="h-5 w-5" />
            Barkod Tarayıcı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-slate-400">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Kamera henüz başlatılmadı</p>
                </div>
              </div>
            )}
            
            {/* Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="border-2 border-green-400 w-64 h-32 rounded-lg animate-pulse">
                  <div className="w-full h-full border border-white/30 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!cameraActive ? (
              <Button onClick={startCamera} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Kamerayı Başlat
              </Button>
            ) : (
              <>
                <Button 
                  onClick={startScan} 
                  disabled={isScanning}
                  className="flex-1"
                >
                  {isScanning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Taranıyor...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4 mr-2" />
                      Tara
                    </>
                  )}
                </Button>
                <Button 
                  onClick={stopCamera} 
                  variant="outline"
                  size="icon"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-800 text-lg">
              <Check className="h-5 w-5" />
              Tarama Sonucu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Barkod:</span>
                <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                  {scanResult.barcode}
                </code>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Tip:</span>
                <Badge variant="secondary">{scanResult.type}</Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Ürün:</span>
                <span className="text-sm font-medium">{scanResult.product}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Güvenilirlik:</span>
                <Badge variant="outline">
                  %{Math.round(scanResult.confidence * 100)}
                </Badge>
              </div>
            </div>

            <Button 
              onClick={resetScan} 
              variant="outline" 
              size="sm" 
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Temizle
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Alert>
        <History className="h-4 w-4" />
        <AlertDescription>
          Barkodu kameranın önüne getirin ve "Tara" butonuna basın. 
          Uygulama otomatik olarak barkodu algılayacaktır.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default BarcodeScanner;