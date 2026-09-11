import {createContext, useState, useEffect} from 'react';

export const ModelosContext = createContext();

const LISTA_MODELOS = [
    {nome: 'Confissão de Dívida', tipo: 'Acordo de Crédito', arquivo: 'confisao-boleto.docx'},
    {nome: 'Notificação - Confisão de Dívida', tipo: 'Notificação', arquivo: 'notificacao-confisao-divida.docx'},
    {nome: 'Notificação - Nf de Compra', tipo: 'Notificação', arquivo: 'notificacao-nf-compra.docx'}
];

export function ModelosProvider({children}) {
    const [modelos, setModelos] = useState({});

    useEffect(() => {
        const carregarTudo = async () => {
            for (const item of LISTA_MODELOS) {
                try {
                    const res = await fetch(`modelos/${item.arquivo}`);
                    const buffer = await res.arrayBuffer();

                    setModelos(prev => ({...prev, [item.nome]: buffer}));
                } catch (e) {
                    console.error('Erro ao carregar modelo:', e);
                }
            }
        };

        carregarTudo();
    }, []);

    const obterModelo = (nome) => modelos[nome];
    const listarModelos = () => LISTA_MODELOS;

    return (
        <ModelosContext.Provider value={{obterModelo, listarModelos}}>
            {children}
        </ModelosContext.Provider>
    );
}