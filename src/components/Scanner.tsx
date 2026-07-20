/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Zap, ZapOff, RefreshCw, Upload, Image as ImageIcon, AlertTriangle, Play, Square } from 'lucide-react';

interface ScannerProps {
  onScanSuccess: (text: string) => void;
  isActive: boolean;
}

export default function Scanner({ onScanSuccess, isActive }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-camera-reader';
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  
  // Drag and drop QR file scan
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep track of the latest scan success callback to prevent stale closures
  const scanSuccessRef = useRef(onScanSuccess);
  useEffect(() => {
    scanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  // Initialize and stop logic
  useEffect(() => {
    if (isActive) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isActive]);

  const startScanner = async () => {
    setHasCameraError(null);
    try {
      // 1. Create instance if not exists
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }

      // Check permissions
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'camera' as any });
          setCameraPermissionState(status.state);
          status.onchange = () => setCameraPermissionState(status.state);
        } catch (e) {
          console.warn('Permissions query not fully supported for camera');
        }
      }

      // 2. Start scanning with environment camera (rear-facing)
      setIsScanning(true);
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (width, height) => {
            const minDim = Math.min(width, height) || 300;
            const targetSize = Math.floor(minDim * 0.65);
            const size = Math.max(150, targetSize);
            const finalSize = Math.min(minDim, size);
            const safeSize = Math.max(50, finalSize);
            return { width: safeSize, height: safeSize };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          scanSuccessRef.current(decodedText);
        },
        () => {
          // Silent hunt - errors occur constantly when QR code is not in frame
        }
      );

      // Check flashlight support
      try {
        const capabilities = scannerRef.current.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasFlashSupport(true);
        } else {
          setHasFlashSupport(false);
        }
      } catch (err) {
        setHasFlashSupport(false);
      }

      setHasCameraError(null);
    } catch (err: any) {
      console.error('Camera Scanner start failed:', err);
      setIsScanning(false);
      setHasCameraError(
        err.message || 
        'Could not access the camera. Ensure browser camera permissions are enabled, or open this app in a new tab.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        setIsFlashOn(false);
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    } else {
      setIsScanning(false);
    }
  };

  const toggleFlashlight = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning || !hasFlashSupport) return;
    
    try {
      const nextFlashState = !isFlashOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextFlashState } as any]
      });
      setIsFlashOn(nextFlashState);
    } catch (err) {
      console.warn('Failed to toggle flashlight:', err);
    }
  };

  // QR Image File Scanning fallback
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    scanImageFile(file);
  };

  const scanImageFile = async (file: File) => {
    try {
      // Temporarily stop camera if running
      const wasCameraRunning = isScanning;
      if (wasCameraRunning) {
        await stopScanner();
      }

      // Create a temporary scanner to read the file
      const fileScanner = new Html5Qrcode('file-scanner-temp');
      const decodedText = await fileScanner.scanFile(file, true);
      
      // Clean up temp reader
      fileScanner.clear();
      
      // Dispatch success
      scanSuccessRef.current(decodedText);

      // Restart camera if it was running
      if (wasCameraRunning) {
        startScanner();
      }
    } catch (err: any) {
      alert(`Invalid QR code image: Could not decode. Please upload a clear QR code image.`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      scanImageFile(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Scanner Wrapper */}
      <div className="relative w-full aspect-square bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-xl group">
        
        {/* Temp element for file reading inside same DOM tree safely */}
        <div id="file-scanner-temp" className="hidden"></div>

        {/* Live Camera Feed container */}
        <div id={containerId} className="w-full h-full object-cover"></div>

        {/* Overlay scanning viewfinder graphics */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Dark mask outside scanner box is automatically generated by html5-qrcode standard render */}
            
            {/* Animated Red Laser Line */}
            <div className="absolute left-[15%] right-[15%] h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" style={{
              top: '50%',
              animation: 'laserMove 2.5s infinite ease-in-out'
            }} />

            {/* Corner brackets */}
            <div className="absolute w-[60%] h-[60%] border-2 border-transparent flex flex-col justify-between">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
              </div>
            </div>

            {/* Scanning Text */}
            <div className="absolute bottom-6 bg-slate-900/85 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-2 backdrop-blur-md tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              AIM CAMERA AT QR CODE
            </div>
          </div>
        )}

        {/* Camera Error / Permission Denied Screen */}
        {hasCameraError && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-slate-100">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3 animate-pulse" />
            <h4 className="font-bold text-white text-base mb-1.5">Camera Access Restricted</h4>
            <p className="text-xs text-slate-400 max-w-xs mb-4 leading-relaxed">
              {hasCameraError.includes('Permission dismissed') || hasCameraError.includes('NotAllowedError')
                ? "Camera permission was dismissed or blocked. Please allow camera permissions in your browser's address bar, click \"Open in new tab\" in top right, or upload a QR image below."
                : hasCameraError}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={startScanner}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all border-0 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Camera Connection
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-all border-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Upload QR Code Image
              </button>
            </div>
          </div>
        )}

        {/* Drag & Drop File Upload Overlay */}
        {!isScanning && !hasCameraError && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer ${isDragging ? 'bg-indigo-900/40 border-2 border-dashed border-indigo-400' : 'bg-slate-900/90'}`}
          >
            <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center text-slate-300 mb-4 group-hover:scale-105 transition-all">
              <Upload className="w-8 h-8" />
            </div>
            <h4 className="font-semibold text-white text-base mb-1">Upload QR Code</h4>
            <p className="text-xs text-slate-400 max-w-xs mb-2">
              Drag and drop an image of a QR code here, or click to browse files.
            </p>
            <p className="text-[10px] text-slate-500">
              Useful if camera is unavailable
            </p>
          </div>
        )}

        {/* Hidden File Input (Always in DOM as a sibling of the overlays) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Control bar inside camera bounds */}
        <div className="absolute top-4 right-4 flex gap-2">
          {/* Torch toggle button (only show if scanning and supported) */}
          {isScanning && hasFlashSupport && (
            <button
              onClick={toggleFlashlight}
              type="button"
              className={`w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md border-0 cursor-pointer transition-all ${isFlashOn ? 'bg-amber-500 text-white' : 'bg-slate-900/75 text-slate-300 hover:text-white'}`}
              title="Toggle Flashlight"
            >
              {isFlashOn ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </button>
          )}

          {/* Start/Stop Camera controls */}
          <button
            onClick={isScanning ? stopScanner : startScanner}
            type="button"
            className="w-10 h-10 rounded-xl bg-slate-900/75 text-slate-300 hover:text-white backdrop-blur-md flex items-center justify-center border-0 cursor-pointer transition-all"
            title={isScanning ? "Pause Camera" : "Resume Camera"}
          >
            {isScanning ? <Square className="w-4 h-4 text-rose-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
          </button>
        </div>
      </div>

      {/* Styled Laser Animation keyframes */}
      <style>{`
        @keyframes laserMove {
          0%, 100% { top: 20%; }
          50% { top: 80%; }
        }
      `}</style>
    </div>
  );
}
