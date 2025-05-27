import React from 'react';

type ImageUploadControlProps = {
  // Props for image state, e.g., onImageSelect: (file: File | null) => void;
  // selectedImage: File | null;
};

const ImageUploadControl: React.FC<ImageUploadControlProps> = (props) => {
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md hover:border-primary transition-colors"> {/* Added hover effect */}
      <label htmlFor="imageUploadInput" className="cursor-pointer block text-sm font-medium text-gray-700 mb-1 text-center">
        Upload de Imagem de Referência (Opcional)
      </label>
      {/* Basic file input for now, can be styled or replaced by a more advanced component */}
      <input id="imageUploadInput" type="file" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
      {/* Placeholder for image preview if an image is selected */}
      <div className="mt-2 text-xs text-gray-400 text-center">Nenhuma imagem selecionada.</div>
    </div>
  );
};

export default ImageUploadControl;
