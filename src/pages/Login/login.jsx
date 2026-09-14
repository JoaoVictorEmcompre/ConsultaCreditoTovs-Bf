import {useState} from "react";
import {useNavigate} from "react-router-dom";
import users from "./users.json";
import logo from "../../assets/logobranca-bf.png";
import {savePermanentLogin, clearPermanentLogin} from "../../services/authService.js";

import "./login.css";

function Login() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        user: "",
        senha: "",
        permanentLogin: false,
    });

    const [erro, setErro] = useState("");
    const [loading, setLoading] = useState(false);

    function handleChange(e) {
        const {name, value, type, checked} = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    function handleSubmit(e) {
        e.preventDefault();
        setErro("");
        setLoading(true);

        const usuarioValido =
            form.user === users.user && form.senha === users.senha;

        if (!usuarioValido) {
            setErro("Usuário ou senha inválidos.");
            setLoading(false);
            return;
        }

        sessionStorage.setItem("usuario-logado", "true");

        if (form.permanentLogin) {
            savePermanentLogin(form.user);
        } else {
            clearPermanentLogin();
        }

        navigate("/");
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <img src={logo} alt="Logo Consulta Crédito" className="login-logo"/>
                    <h1 className="login-title">Consulta Crédito</h1>
                    <p className="login-subtitle">Gestão de crédito e análise financeira</p>
                </div>

                {erro && <p className="login-error">{erro}</p>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="login-field">
                        <label htmlFor="user">Usuário</label>
                        <input
                            id="user"
                            name="user"
                            type="text"
                            value={form.user}
                            onChange={handleChange}
                            placeholder="Digite seu usuário"
                            autoComplete="username"
                            disabled={loading}
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="senha">Senha</label>
                        <input
                            id="senha"
                            name="senha"
                            type="password"
                            value={form.senha}
                            onChange={handleChange}
                            placeholder="Digite sua senha"
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </div>

                    <div className="login-checkbox">
                        <input
                            id="permanent-login"
                            name="permanentLogin"
                            type="checkbox"
                            checked={form.permanentLogin}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <label htmlFor="permanent-login">Manter-me conectado</label>
                    </div>

                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? "Entrando..." : "Entrar"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;