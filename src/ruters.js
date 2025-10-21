import { Router } from 'express'
import Controller from './controller.js'
import client from './redis.js'

const controller = new Controller(client)

const router = (server) => {
    const router = Router()
    server.use('/api/v1', router)

    router.post('/leads/draft', async (req, res) => {
        const leadData = req.body
        const id = leadData.id

        const dataRta = await controller.processLeadDraft(id, leadData)

        res.status(201).json({ message: 'Lead draft created', data: dataRta })
    })
}
export default router