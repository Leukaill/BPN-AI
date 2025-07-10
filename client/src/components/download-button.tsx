import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';

interface DownloadButtonProps {
  downloadUrl: string;
  filename: string;
  format: string;
  size: string;
  expiresAt: string;
}

export function DownloadButton({ downloadUrl, filename, format, size, expiresAt }: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return 'Expired';
    if (diffMins < 60) return `${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Download Available</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">Your file is ready for download</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">File:</span> {filename}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">Format:</span> {format.toUpperCase()}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">Size:</span> {size}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <span className="font-medium">Expires:</span> {formatExpiryTime(expiresAt)}
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition-colors"
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Downloading...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download File
            </>
          )}
        </button>
        
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in New Tab
        </a>
      </div>
    </div>
  );
}