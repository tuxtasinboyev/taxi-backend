import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger('FirebaseService');
    private initialized = false;

    onModuleInit() {
        const jsonPath = path.join(__dirname, 'firebase-service-account.json');
        if (!fs.existsSync(jsonPath)) {
            this.logger.warn('firebase-service-account.json topilmadi — push notification o\'chiq');
            return;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const serviceAccount = require(jsonPath);
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount as ServiceAccount),
                });
            }
            this.initialized = true;
            this.logger.log('Firebase Admin SDK initialized');
        } catch (err) {
            this.logger.warn(`Firebase init failed: ${err.message}`);
        }
    }

    async sendToToken(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            await admin.messaging().send({
                token,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            return true;
        } catch (err) {
            this.logger.warn(`FCM send failed for token ${token.slice(0, 20)}...: ${err.message}`);
            return false;
        }
    }

    async sendToMultipleTokens(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<{ successCount: number; failureCount: number }> {
        if (!this.initialized || !tokens.length) return { successCount: 0, failureCount: 0 };

        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            return {
                successCount: response.successCount,
                failureCount: response.failureCount,
            };
        } catch (err) {
            this.logger.error(`FCM multicast failed: ${err.message}`);
            return { successCount: 0, failureCount: tokens.length };
        }
    }

    async sendToTopic(
        topic: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            await admin.messaging().send({
                topic,
                notification: { title, body },
                data: data ?? {},
                android: { priority: 'high' },
                apns: { payload: { aps: { sound: 'default', badge: 1 } } },
            });
            return true;
        } catch (err) {
            this.logger.error(`FCM topic send failed: ${err.message}`);
            return false;
        }
    }
}
