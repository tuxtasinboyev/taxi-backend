export const userGetResponse = () => (
    {
        status: 200,
        description: 'Foydalanuvchi topildi',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                phone: { type: 'string' },
                username: { type: 'string', nullable: true },
                displayName: { type: 'string', nullable: true },
                bio: { type: 'string', nullable: true },
                avatarUrl: { type: 'string', nullable: true },
                role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPERADMIN'] },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                lastSeen: { type: 'string', format: 'date-time', nullable: true },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            contentText: { type: 'string', nullable: true },
                            contentType: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
                contacts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            contactUserId: { type: 'string' },
                            alias: { type: 'string', nullable: true },
                        },
                    },
                },
                blockedUsers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            blockedId: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
        },
    }
)
export const userGetResponseByUsername = () => (
    {
        status: 200,
        description: 'Foydalanuvchi topildi',
        schema: {
            type: 'object',
            properties: {
                username: { type: 'string' },
                phone: { type: 'string' },
                id: { type: 'string' },
                displayName: { type: 'string', nullable: true },
                bio: { type: 'string', nullable: true },
                avatarUrl: { type: 'string', nullable: true },
                role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPERADMIN'] },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                lastSeen: { type: 'string', format: 'date-time', nullable: true },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            contentText: { type: 'string', nullable: true },
                            contentType: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
                contacts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            contactUserId: { type: 'string' },
                            alias: { type: 'string', nullable: true },
                        },
                    },
                },
                blockedUsers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            blockedId: { type: 'string' },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
            },
        },
    }
)
export const getMessages = {
    status: 200,
    description: 'List of messages for the given chatId',
    schema: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                chatId: { type: 'string' },
                contentText: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                attachments: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            url: { type: 'string' },
                            type: { type: 'string' },
                        },
                    },
                },
                sender: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        displayName: { type: 'string' },
                        username: { type: 'string' },
                        avatarUrl: { type: 'string' },
                    },
                },
            },
        },
    },
}
export const getMeResponse = {
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
        example: {
            success: true,
            message: 'User data retrieved successfully',
            data: {
                user: {
                    id: 'uuid',
                    name_uz: 'Ali',
                    name_ru: 'Али',
                    name_en: 'Ali',
                    phone: '998901234567',
                    email: 'ali@example.com',
                    profile_photo: 'https://example.com/photo.jpg',
                    role: 'driver',
                    created_at: '2024-01-15T10:30:00.000Z',
                    updated_at: '2024-01-15T10:30:00.000Z'
                },
                wallet: {
                    balance: 150000,
                    currency: 'UZS'
                },
                default_card: {
                    id: 'card_uuid',
                    brand: 'Uzcard',
                    last4: '1234',
                    expiry: '12/2025'
                },
                stats: {
                    total_orders: 45,
                    reviews_given: 12,
                    reviews_received: 38,
                    driver: {
                        rating: 4.8,
                        total_reviews: 38,
                        completed_orders: 42,
                        total_earnings: 2500000,
                        car_model: 'Malibu',
                        car_color: 'Oq',
                        car_number: '01A123AA',
                        status: 'online'
                    }
                }
            }
        }
    }
}

export const getAllUser = {
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
        example: {
            success: true,
            data: {
                users: [
                    {
                        id: 'uuid',
                        name_uz: 'Ali',
                        phone: '998901234567',
                        email: 'ali@example.com',
                        role: 'driver',
                        driver_rating: 4.8,
                        total_earnings: 2500000,
                        wallet_balance: 150000,
                        created_at: '2024-01-15T10:30:00.000Z'
                    }
                ],
                pagination: {
                    current_page: 1,
                    total_pages: 5,
                    total_users: 50,
                    has_next: true,
                    has_prev: false,
                    per_page: 10
                }
            },
            timestamp: '2024-01-15T10:30:00.000Z'
        }
    }
}
export const putRessponse = {
    status: 200,
    description: 'Profile updated successfully',
    schema: {
        example: {
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: 'uuid',
                name_uz: 'New Name',
                name_ru: 'New Name',
                name_en: 'New Name',
                phone: '998901234567',
                email: 'new@example.com',
                profile_photo: 'new-photo.jpg',
                role: 'driver',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: '2024-01-15T11:30:00.000Z',
                wallet: {
                    balance: 150000,
                    currency: 'UZS'
                }
            }
        }
    }
}
export const getMeResponseDriver = {
    status: 200,
    description: 'Driver profile retrieved successfully',
    schema: {
        example: {
            success: true,
            message: 'Driver retrieved successfully',
            data: {
                id: 'uuid',
                name_uz: 'Azizbek',
                phone: '+998901234567',
                email: 'azizbek@example.com',
                profile_photo: 'https://example.com/uploads/photo.jpg',
                role: 'driver',
                driver: {
                    car_model_uz: 'Cobalt',
                    car_color_uz: 'Oq',
                    car_number: '80A123BC',
                    status: 'offline',
                    rating: 4.8,
                },
            },
        },
    },
}
export const putMeResponseDriver = {
    status: 200,
    description: 'Driver profile successfully updated',
    schema: {
        example: {
            success: true,
            message: 'Driver successfully updated',
            data: {
                user: {
                    id: 'uuid',
                    name_uz: 'Azizbek',
                    phone: '+998901234567',
                    email: 'azizbek@example.com',
                    profile_photo: 'https://example.com/uploads/photo.jpg',
                },
                driver: {
                    car_model_uz: 'Cobalt',
                    car_color_uz: 'Oq',
                    car_number: '80A123BC',
                    status: 'offline',
                },
            },
        },
    },
}