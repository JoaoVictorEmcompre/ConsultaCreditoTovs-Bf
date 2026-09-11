import ConsultaCredito from "./pages/ConsultaCredito/ConsultaCredito.jsx";
import Login from "./pages/Login/login.jsx";
import {ModelosProvider} from "./context/ModelosContext";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";

function App() {
    return (
        <BrowserRouter basename="/consulta-credito-totvs-bf/">
            <ModelosProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<ConsultaCredito />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ModelosProvider>
        </BrowserRouter>
    );
}

export default App;