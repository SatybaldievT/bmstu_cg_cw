import './App.css';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChartPage from './components/chartPage';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <header className="App-header">
          <Routes>
            <Route path="/" element={<ChartPage />} />
          </Routes>
        </header>
      </div>
    </BrowserRouter>
  );
}

export default App;
