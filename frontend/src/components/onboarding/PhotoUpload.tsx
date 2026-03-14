import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

interface PhotoUploadProps {
  onContinue: () => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function PhotoUpload({ onContinue }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setUploadState('idle');
    setErrorMsg('');
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploadState('uploading');
    setErrorMsg('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/media/upload-photo?use_as_avatar=true', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadState('done');
    } catch {
      setUploadState('error');
      setErrorMsg('上传失败，请检查网络后重试');
    }
  };

  const handleSkip = () => onContinue();

  const handleContinue = () => {
    if (uploadState === 'idle' && preview) {
      handleUpload().then(() => onContinue());
    } else {
      onContinue();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Progress bar placeholder — shows step 0 */}
      <div className="mb-8">
        <div className="flex justify-between items-center text-sm text-monet-haze mb-2 font-serif">
          <span>上传照片</span>
          <span>准备阶段</span>
        </div>
        <div className="h-2 bg-monet-haze/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-monet-sage/50 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '5%' }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h2 className="font-serif text-2xl font-bold text-monet-leaf mb-2">
          上传你的照片
        </h2>
        <p className="font-serif text-monet-haze text-sm mb-8 max-w-md mx-auto">
          AI 会将你的形象转化为专属插画角色，让故事里的主角真的是「你」。
          <br />
          不上传也完全没关系，只是插图会缺少你的专属风格。
        </p>

        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative mx-auto w-48 h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all overflow-hidden
            ${preview
              ? 'border-monet-sage/50 bg-transparent'
              : 'border-monet-haze/40 bg-white/50 hover:border-monet-sage/60 hover:bg-monet-sage/5'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.img
                key="preview"
                src={preview}
                alt="预览"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full object-cover"
              />
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-3 p-4"
              >
                <div className="w-14 h-14 rounded-full bg-monet-haze/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-monet-haze/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <p className="text-xs text-monet-haze/60 font-serif">点击选择照片</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload done badge */}
          {uploadState === 'done' && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="bg-white/90 rounded-full p-2">
                <svg className="w-8 h-8 text-monet-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Status messages */}
        <div className="mt-4 min-h-[1.5rem]">
          {uploadState === 'uploading' && (
            <p className="text-sm text-monet-haze font-serif">正在上传…</p>
          )}
          {uploadState === 'done' && (
            <p className="text-sm text-monet-sage font-serif">上传成功！AI 将在后台生成你的专属插画角色</p>
          )}
          {uploadState === 'error' && (
            <p className="text-sm text-red-400 font-serif">{errorMsg}</p>
          )}
          {!preview && uploadState === 'idle' && (
            <p className="text-xs text-monet-haze/50 font-serif">支持 JPG / PNG，最大 10MB</p>
          )}
        </div>

        {/* Upload button (only when file selected but not yet uploaded) */}
        {preview && uploadState === 'idle' && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleUpload}
            className="mt-4 px-6 py-2 bg-monet-sage text-white rounded-full text-sm font-serif hover:bg-monet-sage/90 transition-all shadow-monet"
          >
            上传这张照片
          </motion.button>
        )}

        {/* Replace photo button */}
        {preview && uploadState !== 'uploading' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="block mx-auto mt-2 text-xs text-monet-haze/50 hover:text-monet-haze transition-colors font-serif"
          >
            更换照片
          </button>
        )}
      </motion.div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-10">
        <button
          onClick={handleSkip}
          className="px-6 py-2.5 text-monet-haze hover:text-monet-leaf transition-colors font-serif text-sm"
        >
          跳过，不上传
        </button>
        <button
          onClick={handleContinue}
          disabled={uploadState === 'uploading'}
          className="px-8 py-2.5 bg-monet-sage text-white rounded-full font-medium hover:bg-monet-sage/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-monet font-serif"
        >
          继续 →
        </button>
      </div>
    </div>
  );
}
