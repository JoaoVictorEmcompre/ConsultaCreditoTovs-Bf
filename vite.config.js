import {Buffer} from 'node:buffer'
import process from 'node:process'
import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react-swc'

// O Zammad não libera o header "Authorization" no CORS (e a URL secundária
// redireciona no preflight, o que o navegador bloqueia sempre). Por isso as
// chamadas ao Zammad passam por aqui: o browser chama um path relativo (mesma
// origem, sem CORS) e o proxy busca no Zammad de verdade, injetando o Basic
// Auth do lado do servidor — a senha nunca chega a ir pro bundle do cliente.
//
// Importante: isso NÃO é um proxy genérico pra API do Zammad — essa
// aplicação não tem autenticação de verdade (é uma SPA estática, servida em
// URL pública), então expor a API inteira aqui daria a qualquer visitante
// acesso de leitura a todos os tickets/clientes do Zammad usando a credencial
// de serviço. Por isso só existem duas rotas, cada uma amarrada a um
// CPF/CNPJ: buscar tickets desse CPF/CNPJ, e ler a conversa de um ticket
// específico — mas só depois de revalidar que aquele ticket pertence mesmo
// a esse CPF/CNPJ (senão bastaria adivinhar um id numérico pra ler o
// atendimento de outro cliente).
function zammadProxyPlugin(env) {
    const zammadUrls = [env.VITE_ZAMMAD_URL, env.VITE_ZAMMAD_URL_2].filter(Boolean)
    const authHeader = 'Basic ' + Buffer.from(`${env.VITE_ZAMMAD_USER}:${env.VITE_ZAMMAD_PASSWORD}`).toString('base64')

    const CPF_CNPJ_RE = /^\d{11,14}$/
    const TICKET_ID_RE = /^\d{1,19}$/

    const fetchZammad = async (path) => {
        let ultimoErro = new Error('Nenhuma URL do Zammad configurada.')

        for (const baseUrl of zammadUrls) {
            try {
                const upstream = await fetch(`${baseUrl}${path}`, {
                    headers: {Authorization: authHeader, Accept: 'application/json'},
                })

                if (!upstream.ok) {
                    ultimoErro = new Error(`Zammad respondeu ${upstream.status}`)
                    continue
                }

                return await upstream.json()
            } catch (error) {
                ultimoErro = error
            }
        }

        throw ultimoErro
    }

    const buscarTicketsPorCpfCnpj = (cpfCnpj) =>
        fetchZammad(`/api/v1/tickets/search?query=${encodeURIComponent(`customer.login:${cpfCnpj}`)}&limit=20&expand=true`)

    const sendJson = (res, status, body) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
    }

    const handleTickets = async (searchParams, res) => {
        const cpfCnpj = searchParams.get('cpf') || ''

        if (!CPF_CNPJ_RE.test(cpfCnpj)) {
            sendJson(res, 400, {error: 'Parâmetro cpf inválido.'})
            return
        }

        try {
            const tickets = await buscarTicketsPorCpfCnpj(cpfCnpj)
            sendJson(res, 200, tickets)
        } catch (error) {
            sendJson(res, 502, {error: 'Zammad indisponível', detail: String(error)})
        }
    }

    const handleTicketArticles = async (searchParams, res) => {
        const ticketId = searchParams.get('ticketId') || ''
        const cpfCnpj = searchParams.get('cpf') || ''

        if (!TICKET_ID_RE.test(ticketId) || !CPF_CNPJ_RE.test(cpfCnpj)) {
            sendJson(res, 400, {error: 'Parâmetros inválidos.'})
            return
        }

        try {
            const ticketsDoCliente = await buscarTicketsPorCpfCnpj(cpfCnpj)
            const pertenceAoCliente = Array.isArray(ticketsDoCliente) &&
                ticketsDoCliente.some((ticket) => String(ticket.id) === ticketId)

            if (!pertenceAoCliente) {
                sendJson(res, 403, {error: 'Ticket não pertence a esse CPF/CNPJ.'})
                return
            }

            const artigos = await fetchZammad(`/api/v1/ticket_articles/by_ticket/${ticketId}`)
            sendJson(res, 200, artigos)
        } catch (error) {
            sendJson(res, 502, {error: 'Zammad indisponível', detail: String(error)})
        }
    }

    const middleware = (req, res, next) => {
        if (req.method !== 'GET') return next()

        const {pathname, searchParams} = new URL(req.url, 'http://localhost')
        const marker = '/zammad-api'
        const idx = pathname.indexOf(marker)
        if (idx === -1) return next()

        const rota = pathname.slice(idx + marker.length)

        if (rota === '/tickets') {
            handleTickets(searchParams, res).catch(next)
            return
        }

        if (rota === '/ticket-articles') {
            handleTicketArticles(searchParams, res).catch(next)
            return
        }

        sendJson(res, 404, {error: 'Rota não encontrada.'})
    }

    return {
        name: 'zammad-proxy',
        configureServer(server) {
            server.middlewares.use(middleware)
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware)
        },
    }
}

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '')

    return {
        plugins: [react(), zammadProxyPlugin(env)],
        assetsInclude: ['**/*.docx'],
        base: '/consulta-credito-totvs-bf/',
        preview: {
            host: true,
            port: 4173,
            allowedHosts: ['felizacordarcolchoes.com.br']
        }
    }
})
