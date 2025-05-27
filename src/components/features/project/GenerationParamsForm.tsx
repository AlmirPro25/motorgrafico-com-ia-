import React from 'react';
// import InputField from '@components/common/InputField'; // If using for params

type GenerationParamsFormProps = {
  // Props to manage parameter state, e.g., params: any; onParamsChange: (newParams: any) => void;
};

const GenerationParamsForm: React.FC<GenerationParamsFormProps> = (props) => {
  return (
    <div className="p-4 bg-neutral rounded-md shadow-sm"> {/* Using theme color 'neutral' */}
      <h2 className="text-lg font-semibold text-primary mb-3">Parâmetros de Geração (Opcional)</h2> {/* Using theme color 'primary' */}
      <p className="text-sm text-gray-600 mb-4">
        Ajuste fino para a IA (ex: estilo artístico, nível de detalhe, complexidade).
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="artStyle" className="block text-xs font-medium text-gray-700">Estilo Artístico</label>
          <select 
            id="artStyle" 
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          >
            <option>Automático</option>
            <option>Realista</option>
            <option>Cartoon</option>
            <option>Low Poly</option>
            <option>Abstrato</option>
            <option>Fantasia</option>
            <option>Sci-Fi</option>
          </select>
        </div>
        <div>
          <label htmlFor="detailLevel" className="block text-xs font-medium text-gray-700">Nível de Detalhe</label>
          <select 
            id="detailLevel" 
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          >
            <option>Médio</option>
            <option>Baixo</option>
            <option>Alto</option>
          </select>
        </div>
        {/* Add more parameter controls as needed */}
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Estes são exemplos. Mais controles podem ser adicionados aqui.
      </p>
    </div>
  );
};

export default GenerationParamsForm;
