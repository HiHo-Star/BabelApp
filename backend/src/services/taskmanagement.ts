/**
 * TaskManagement Agent Service - Communicates with the Python TaskManagement-agent
 */

const TASKMANAGEMENT_SERVICE_URL = process.env.TASKMANAGEMENT_SERVICE_URL || 'http://localhost:8004';

interface ProcessRequest {
  userId: string;
  text: string;
  language?: string;
  context?: Record<string, any>;
}

interface ProcessResponse {
  intent: string;
  status: 'complete' | 'needs_clarification' | 'multiple_tasks';
  language: string;
  tasks?: any[];
  clarification?: {
    question: string;
    field: string;
    options?: string[];
  };
  multipleTasksSuggestion?: {
    message: string;
    task1: any;
    task2: any;
  };
  execution_time_ms?: number;
}

export class TaskManagementService {
  private static instance: TaskManagementService;
  private serviceUrl: string;

  private constructor() {
    this.serviceUrl = TASKMANAGEMENT_SERVICE_URL;
  }

  public static getInstance(): TaskManagementService {
    if (!TaskManagementService.instance) {
      TaskManagementService.instance = new TaskManagementService();
    }
    return TaskManagementService.instance;
  }

  /**
   * Process natural language input for task-related operations
   */
  async process(
    userId: string,
    text: string,
    language?: string,
    context?: Record<string, any>
  ): Promise<ProcessResponse> {
    try {
      const requestData: ProcessRequest = {
        userId,
        text,
        language: language || 'en',
        context: {
          userId,
          ...context
        }
      };

      console.log(`[TaskManagement] Sending request to service: ${this.serviceUrl}/api/task-management/process`);
      console.log(`[TaskManagement] Request data:`, requestData);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(`${this.serviceUrl}/api/task-management/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData: any = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.detail?.error || response.statusText}`);
        }

        const responseData = await response.json() as ProcessResponse;
        console.log(`[TaskManagement] Received response:`, responseData);
        return responseData;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - TaskManagement service did not respond in time');
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[TaskManagement] Error communicating with service:', error);
      
      // Re-throw with a more descriptive message
      throw new Error(
        error.message || 
        'Failed to communicate with TaskManagement service'
      );
    }
  }

  /**
   * Check if TaskManagement service is healthy
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

      const data = await response.json() as { status?: string };
      return data.status === 'healthy';
    } catch (error) {
      console.error('[TaskManagement] Health check failed:', error);
      return false;
    }
  }
}

export const taskManagementService = TaskManagementService.getInstance();

