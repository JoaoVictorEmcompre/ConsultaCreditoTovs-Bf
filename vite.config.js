import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [react()],
    assetsInclude: ['**/*.docx'],
    base: '/consulta-credito-totvs-bf/',
    preview: {
        host: true,
        port: 4173,
        allowedHosts: ['felizacordarcolchoes.com.br']
    }
})