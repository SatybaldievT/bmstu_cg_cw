import './App.css';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChartPage from './components/chartPage';

function App() {
  return (
    <BrowserRouter>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jstat/3.0.1/dist/jstat.min.js"></script>
      <div className="App">
          <Routes>
            <Route path="/" element={<ChartPage />} />
          </Routes>
        
      </div>
    </BrowserRouter>
  );
}

export default App;
