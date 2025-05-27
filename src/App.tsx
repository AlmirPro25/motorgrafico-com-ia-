import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateProjectPage from './pages/CreateProjectPage';
import EditorPage from './pages/EditorPage';
import CreateCharacterPage from './pages/CreateCharacterPage';
import RenderExportPage from './pages/RenderExportPage';
import LibraryPage from './pages/LibraryPage';
// Import other necessary components like a Navbar or Header if they were planned for App.tsx

const App: React.FC = () => {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/create-project">Create Project</Link></li>
            <li><Link to="/editor/some-project-id">Editor</Link></li> {/* Example with a param */}
            <li><Link to="/create-character">Create Character</Link></li>
            <li><Link to="/render-export/some-project-id">Render/Export</Link></li> {/* Example with a param */}
            <li><Link to="/library">Library</Link></li>
          </ul>
        </nav>

        <hr />

        <Routes>
          <Route path="/create-project" element={<CreateProjectPage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="/create-character" element={<CreateCharacterPage />} />
          <Route path="/render-export/:projectId" element={<RenderExportPage />} />
          <Route path="/library" element={<LibraryPage />} />
          {/* Define a default route, e.g., to CreateProjectPage or a HomePage if one exists */}
          <Route path="/" element={<CreateProjectPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
