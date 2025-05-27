import React from 'react';

type PreviewAreaProps = {
  // Props for status, preview image URL, etc.
  // statusText?: string;
  // previewImageUrl?: string;
};

const PreviewArea: React.FC<PreviewAreaProps> = (props) => {
  return (
    <div className="p-4 bg-neutral rounded-md min-h-[120px] shadow-sm flex items-center justify-center"> {/* Using theme color 'neutral' */}
      <p className="text-sm text-gray-500 italic text-center">
        Área de Preview Conceitual / Status da Geração
        <br />
        (Aguardando início da criação...)
      </p>
      {/* 
      {props.previewImageUrl && <img src={props.previewImageUrl} alt="Preview" className="max-h-full rounded-md shadow"/>}
      {props.statusText && <p className="text-sm text-primary">{props.statusText}</p>} 
      */}
    </div>
  );
};

export default PreviewArea;
