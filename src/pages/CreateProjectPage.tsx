import React, { useState } from 'react';
import InputField from '@components/common/InputField';
import PrimaryButton from '@components/common/PrimaryButton';
import ImageUploadControl from '@components/features/project/ImageUploadControl';
import GenerationParamsForm from '@components/features/project/GenerationParamsForm';
import PreviewArea from '@components/features/project/PreviewArea';

const CreateProjectPage: React.FC = () => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [textPrompt, setTextPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for submission logic
    console.log('Form submitted with states:');
    console.log('Project Name:', projectName);
    console.log('Project Description:', projectDescription);
    console.log('Text Prompt:', textPrompt);
    // In a real scenario, you would gather form data from state here
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow-lg rounded-lg my-8">
      <h1 className="text-3xl font-bold text-primary mb-8 text-center">Criar Novo Projeto/Mundo IA</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <InputField
            label="Nome do Projeto"
            id="projectName"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Ex: Floresta Encantada"
            required
          />
        </div>

        <div>
          <InputField
            as="textarea"
            label="Descrição do Projeto"
            id="projectDescription"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Descreva brevemente o seu projeto ou mundo. (e.g., um RPG de fantasia medieval, uma simulação de cidade futurista, uma experiência artística abstrata)"
            rows={3}
            required
          />
        </div>

        <div>
          <InputField
            as="textarea"
            label="Prompt de Texto para Geração IA (Opcional)"
            id="aiPrompt"
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="Detalhe o que você quer gerar. Ex: 'Uma vasta floresta mágica com árvores luminescentes que pulsam com uma luz azul suave, um rio cristalino que reflete o céu estrelado, e pequenas criaturas místicas com asas brilhantes voando entre as árvores. O ambiente deve ter uma sensação de mistério e tranquilidade.'"
            rows={6}
          />
          <p className="mt-2 text-xs text-gray-500">
            Se preenchido, a IA tentará gerar um modelo 3D inicial baseado neste prompt.
          </p>
        </div>

        <ImageUploadControl />

        <GenerationParamsForm />

        <PreviewArea />

        <div className="pt-4 flex justify-end">
          <PrimaryButton
            label="Criar Mundo/Projeto com IA"
            onClick={() => {}} // Will be handled by form onSubmit
            type="submit"
            // disabled={true} // Example: disable until form is valid or while processing
          />
        </div>
      </form>
    </div>
  );
};

export default CreateProjectPage;
