/**
 * BabelBot Service - Communicates with the Python BabelBot Agent
 */

const BABELBOT_SERVICE_URL = process.env.BABELBOT_SERVICE_URL || 'http://localhost:8003';

interface ChatRequest {
  message: string;
  session_id?: string;
  context?: Record<string, any>;
}

interface ChatResponse {
  session_id: string;
  message: string;
  execution_time_ms: number;
}

export class BabelBotService {
  private static instance: BabelBotService;
  private serviceUrl: string;

  private constructor() {
    this.serviceUrl = BABELBOT_SERVICE_URL;
  }

  public static getInstance(): BabelBotService {
    if (!BabelBotService.instance) {
      BabelBotService.instance = new BabelBotService();
    }
    return BabelBotService.instance;
  }

  /**
   * Send a message to BabelBot and get a response
   */
  async chat(
    message: string,
    userId: string,
    sessionId?: string,
    context?: Record<string, any>
  ): Promise<ChatResponse> {
    try {
      const requestData: ChatRequest = {
        message,
        session_id: sessionId || `babelbot-${userId}`,
        context: {
          user_id: userId,
          ...context
        }
      };

      console.log(`[BabelBot] Sending message to chatbot service: ${this.serviceUrl}/chat`);
      console.log(`[BabelBot] Request data:`, requestData);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(`${this.serviceUrl}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.detail?.error || response.statusText}`);
        }

        const responseData: ChatResponse = await response.json();
        console.log(`[BabelBot] Received response:`, responseData);
        return responseData;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - BabelBot service did not respond in time');
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[BabelBot] Error communicating with chatbot service:', error);
      
      if (error.response) {
        console.error('[BabelBot] Response status:', error.response.status);
        console.error('[BabelBot] Response data:', error.response.data);
      } else if (error.request) {
        console.error('[BabelBot] No response received. Service may be down.');
      }

      // Return a fallback response
      throw new Error(
        error.response?.data?.detail?.error || 
        error.message || 
        'Failed to communicate with BabelBot service'
      );
    }
  }

  /**
   * Check if BabelBot service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serviceUrl}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('[BabelBot] Health check failed:', error);
      return false;
    }
  }
}

export const babelBotService = BabelBotService.getInstance();

