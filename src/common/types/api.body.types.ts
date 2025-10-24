import { Prisma } from "@prisma/client";

export const CreateUserApiBody = {
  description: 'Foydalanuvchi yaratish uchun kerakli maydonlar va avatar rasm',
  schema: {
    type: 'object',
    properties: {
      phone: {
        type: 'string',
        example: '+998901234567',
        description: "Foydalanuvchining telefon raqami"
      },
      displayName: {
        type: 'string',
        example: 'John Doe',
        description: "Foydalanuvchining to‘liq ismi"
      },
      bio: {
        type: 'string',
        example: 'Web developer',
        description: "Foydalanuvchi haqida qisqacha ma’lumot"
      },
      password: {
        type: 'string',
        example: 'strongPassword123',
        description: "Foydalanuvchining paroli"
      },
      role: {
        type: 'string',
        enum: ['USER', 'ADMIN', 'SUPERADMIN'],
        default: 'USER',
        description: "Foydalanuvchi roli"
      },
      avatar: {
        type: 'string',
        format: 'binary',
        description: "Foydalanuvchi avatari (rasm fayl)"
      },
    },
    required: ['phone', 'password'],
  },
};




export const RequiredHouseApiBody = {
  description: 'Uy ma`lumotlari va rasm fayllari (kamida 3 ta)',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      address: { type: 'string' },
      floor: { type: 'number' },
      allFloor: { type: 'number' },
      area: { type: 'decimal' },
      price: { type: 'number' },
      rooms: { type: 'number' },
      categoryId: { type: 'number' },
      images: { type: 'array', items: { type: 'string', format: 'binary' } },
    },
    required: ['title', 'address', 'price', 'rooms', 'images'],
  },
}
export const UpdateUserApiBody = {
  description: 'Foydalanuvchi ma’lumotlarini yangilash va avatarni o‘zgartirish',
  schema: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '+998901234567' },
      displayName: { type: 'string', example: 'John Doe' },
      username: { type: 'string', example: '@JohnDoe' },
      bio: { type: 'string', example: 'Web developer' },
      password: { type: 'string', example: 'strongPassword123' },
      role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPERADMIN'], example: 'USER' },
      avatar: { type: 'string', format: 'binary', description: 'Foydalanuvchi avatari (rasm fayl)' },
    },
  },
};
export const UpdateMeApiBody = {
  description: 'Foydalanuvchi ma’lumotlarini yangilash va avatarni o‘zgartirish',
  schema: {
    type: 'object',
    properties: {
      phone: { type: 'string', example: '+998901234567' },
      displayName: { type: 'string', example: 'John Doe' },
      username: { type: 'string', example: '@JohnDoe' },
      bio: { type: 'string', example: 'Web developer' },
      password: { type: 'string', example: 'strongPassword123' },
      avatar: { type: 'string', format: 'binary', description: 'Foydalanuvchi avatari (rasm fayl)' },
    },
  },
};
export const createChatApiBody = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['PRIVATE', 'GROUP', 'CHANNEL'] },
      members: { type: 'array', items: { type: 'string' } },
      description: { type: 'string' },
      photo: { type: 'string', format: 'binary' } // fayl upload
    },
    required: ['type', 'members']
  }
}
export const updateChatApiBody = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      isPublic: { type: 'boolean' },
      photo: { type: 'string', format: 'binary' }
    }
  }
}
export const sendMessageApiBody = {
  schema: {
    type: 'object',
    properties: {
      chatId: { type: 'string' },
      contentText: { type: 'string', nullable: true },
      replyToMessageId: { type: 'string', nullable: true },
      forwardedFromId: { type: 'string', nullable: true },
      files: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    },
    required: ['chatId'],
  },
};
export const getAllMessageApiBody = (userId: string) => ({
  where: {
    OR: [
      { senderId: userId },
      { receiverId: userId }
    ]
  },
  include: {
    attachments: true,
    sender: {
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    },
    receiver: {
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    }
  },
  orderBy: {
    createdAt: Prisma.SortOrder.desc
  }
})
export const registerApiBody = {
  schema: {
    type: 'object',
    properties: {
      lang: { type: 'string', example: 'uz', enum: ['uz', 'en', 'ru'] },
      name: { type: 'string', example: 'Otabek' },
      phone: { type: 'string', example: '+998901234567' },
      email: { type: 'string', example: 'user@example.com' },
      password: { type: 'string', example: '123456' },
      photo: {
        type: 'string',
        format: 'binary',
      },
    },
  },
}

export const createUser = {
  description: 'Create user with profile photo',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', example: 'john@example.com' },
      phone: { type: 'string', example: '998901234567' },
      password: { type: 'string', example: 'password123' },
      role: {
        type: 'string',
        enum: ['passenger', 'driver', 'admin'],
        example: 'passenger'
      },
      lang: {
        type: 'string',
        enum: ['uz', 'ru', 'en'],
        example: 'uz'
      },
      photo: {
        type: 'string',
        format: 'binary',
        description: 'Profile photo file (jpg, jpeg, png, webp)'
      }
    },
    required: ['name', 'email', 'phone', 'password', 'role', 'lang']
  }
}
export const putApiBody = {
  description: 'Update user profile',
  schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        example: 'New Name',
        description: 'User name (will be updated based on language)',
      },
      email: {
        type: 'string',
        example: 'new@example.com',
        description: 'User email',
      },
      phone: {
        type: 'string',
        example: '+998901234567',
        description: 'Phone number',
      },
      password: {
        type: 'string',
        example: 'newpassword123',
        description: 'New password (optional)',
      },
      lang: {
        type: 'string',
        enum: ['uz', 'ru', 'en'],
        example: 'uz',
        description:
          'Language — determines which field (name_uz, name_ru, name_en) is updated',
      },
      photo: {
        type: 'string',
        format: 'binary',
        description: 'Profile photo file (jpg, jpeg, png, webp)',
      },
    },
  },
};
