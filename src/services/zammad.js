// O Zammad não libera o header Authorization via CORS, então as chamadas não
// vão direto do browser pra ele — passam pelo proxy same-origin definido em
// vite.config.js (dev e preview), que injeta o Basic Auth do lado do servidor,
// cuida do fallback entre VITE_ZAMMAD_URL e VITE_ZAMMAD_URL_2, e restringe o
// acesso às duas rotas abaixo (nunca à API do Zammad como um todo).
const ZAMMAD_PROXY_BASE = `${import.meta.env.BASE_URL}zammad-api`;

const zammadFetch = async (path) => {
    const response = await fetch(`${ZAMMAD_PROXY_BASE}${path}`, {
        headers: {
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const corpo = await response.json().catch(() => null);
        throw new Error(corpo?.error || `Requisição Zammad falhou: ${response.statusText}`);
    }

    return response.json();
};

export const searchZammadTicketsByCustomerCpfCnpj = async (cpfCnpj) => {
    try {
        const tickets = await zammadFetch(`/tickets?cpf=${encodeURIComponent(cpfCnpj)}`);
        const lista = Array.isArray(tickets) ? tickets : [];
        return lista.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    } catch (error) {
        console.error("Erro ao buscar tickets Zammad:", error);
        throw error;
    }
};

// O proxy revalida que o ticket pertence a esse CPF/CNPJ antes de devolver a
// conversa — por isso os dois têm que vir juntos aqui.
export const getZammadTicketArticles = async (ticketId, cpfCnpj) => {
    if (!cpfCnpj) {
        throw new Error("Ticket sem CPF/CNPJ associado — não é possível carregar a conversa.");
    }

    try {
        const artigos = await zammadFetch(
            `/ticket-articles?ticketId=${encodeURIComponent(ticketId)}&cpf=${encodeURIComponent(cpfCnpj)}`
        );
        return Array.isArray(artigos) ? artigos : [];
    } catch (error) {
        console.error(`Erro ao buscar artigos do ticket ${ticketId}:`, error);
        throw error;
    }
};
