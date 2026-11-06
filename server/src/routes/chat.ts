import { Router } from 'express';
import { ChatService, ChatRequestError } from '../services/ChatService';
import { logger } from '../utils/logger';

export const chatRouter = Router();

chatRouter.post('/stream', async (req, res) => {
  try {
    await ChatService.streamChat(req.body, res);
  } catch (error) {
    if (error instanceof ChatRequestError) {
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message, status: error.status })}\n\n`);
        res.end();
        return;
      }
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }

    logger.error('Unhandled chat error', { error: String(error) });
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Unexpected server error.' })}\n\n`);
      res.end();
      return;
    }
    res.status(500).json({ error: { message: 'Unexpected server error.' } });
  }
});
