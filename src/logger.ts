import fs from 'fs';
import path from 'path';

let logStream: fs.WriteStream | null = null;
let logQueue: string[] = [];

function write(message: string) {
    if (logStream) {
        // If the stream is ready, write all queued messages first
        if (logQueue.length > 0) {
            logStream.write(logQueue.join(''));
            logQueue = [];
        }
        logStream.write(message);
    } else {
        // If the stream is not ready, queue the message
        logQueue.push(message);
        // Also write to stderr as a fallback
        console.error(message.trim());
    }
}

export function initializeLogger(logFilePath?: string) {
    // Skip file logging in DXT environment
    if (process.env.DXT_ENVIRONMENT || process.env.QUICKBOOKS_NO_FILE_LOGGING) {
        console.error("Logger: Running in read-only environment, using stderr only");
        return;
    }
    
    if (!logFilePath) {
        console.error("Logger initialized without a file path. Logging to stderr only.");
        return;
    }
    
    // Defer all file operations to avoid blocking startup in read-only DXT environment
    setImmediate(async () => {
        try {
            const logDir = path.dirname(logFilePath);
            
            // Use async file operations to avoid blocking
            try {
                await fs.promises.mkdir(logDir, { recursive: true });
            } catch (err) {
                // Directory might already exist or we might not have permissions
                // This is OK - we'll try to create the stream anyway
            }
            
            // Create write stream
            const stream = fs.createWriteStream(logFilePath, { flags: 'a' });
            
            stream.on('open', () => {
                console.error(`Logger: Successfully opened log file at ${logFilePath}`);
                logStream = stream;
                
                // Flush any queued messages
                if (logQueue.length > 0) {
                    logStream.write(logQueue.join(''));
                    logQueue = [];
                }
            });
            
            stream.on('error', (err) => {
                console.error(`Logger: Failed to open log file at ${logFilePath}: ${err.message}`);
                console.error('Logger: Falling back to stderr only');
                logStream = null;
            });
        } catch (error) {
            console.error(`Logger: Failed to initialize file logging: ${error instanceof Error ? error.message : error}`);
            console.error('Logger: Falling back to stderr only');
            logStream = null;
        }
    });
}

const formatMessage = (level: string, message: string, error?: any): string => {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (error) {
        const errorString = error instanceof Error ? error.stack : JSON.stringify(error);
        logMessage += `\n${errorString}`;
    }
    return logMessage + '\n';
};

export const logger = {
    info: (message: string) => {
        write(formatMessage('info', message));
    },
    warn: (message: string) => {
        write(formatMessage('warn', message));
    },
    error: (message: string, error?: any) => {
        write(formatMessage('error', message, error));
    },
    debug: (message: string) => {
        if (process.env.enableDebugLogging === 'true') {
            write(formatMessage('debug', message));
        }
    }
};