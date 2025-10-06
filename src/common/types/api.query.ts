// import { ChatType, MemberRole, PrismaClient } from "@prisma/client";
// export const GetUserByIdQuery = (id: string) => ({
//     where: { id },
//     select: {
//         id: true,
//         phone: true,
//         username: true,
//         displayName: true,
//         bio: true,
//         avatarUrl: true,
//         role: true,
//         isActive: true,
//         createdAt: true,
//         lastSeen: true,
//         sentMessages: {
//             select: {
//                 id: true,
//                 contentText: true,
//                 createdAt: true,
//             },
//         },
//         receivedMessages: {
//             select: {
//                 id: true,
//                 contentText: true,
//                 createdAt: true,
//             },
//         },
//         blockedUsers: {
//             select: {
//                 blockedId: true,
//                 createdAt: true,
//             },
//         },
//     },
// });

// export const GetUserByUsernameQuery = (username: string) => ({
//     where: { username },
//     select: {
//         id: true,
//         phone: true,
//         username: true,
//         displayName: true,
//         bio: true,
//         avatarUrl: true,
//         role: true,
//         isActive: true,
//         createdAt: true,
//         lastSeen: true,
//         sentMessages: {
//             select: {
//                 id: true,
//                 contentText: true,
//                 createdAt: true,
//             },
//         },
//         receivedMessages: {
//             select: {
//                 id: true,
//                 contentText: true,
//                 createdAt: true,
//             },
//         },
//         blockedUsers: {
//             select: {
//                 blockedId: true,
//                 createdAt: true,
//             },
//         },
//     },
// });

// export const GetUserAll = (take, skip) => (
//     {
//         skip: skip,
//         take: take,
//         select: {
//             id: true,
//             phone: true,
//             username: true,
//             displayName: true,
//             bio: true,
//             avatarUrl: true,
//             role: true,
//             isActive: true,
//             createdAt: true,
//             lastSeen: true,
//             sentMessages: {
//                 select: {
//                     id: true,
//                     contentText: true,
//                     createdAt: true,
//                 },
//             },
//             receivedMessages: {
//                 select: {
//                     id: true,
//                     contentText: true,
//                     createdAt: true,
//                 },
//             },
//             blockedUsers: {
//                 select: {
//                     blockedId: true,
//                     createdAt: true,
//                 },
//             },
//         },
//     }
// )

// export const findPrivateChat = async (
//     db: PrismaClient,
//     user1: string,
//     user2: string
// ) => {
//     return db.chat.findFirst({
//         where: {
//             type: ChatType.PRIVATE,
//             members: { some: { userId: user1 } },
//             AND: { members: { some: { userId: user2 } } },
//         },
//         include: { members: true },
//     });
// };

// export const createChatMember = (chat, targetUser, data) => (
//     {
//         data: {
//             chatId: chat.id,
//             userId: targetUser.id,
//             role: data.role ?? MemberRole.MEMBER,
//         },
//         include: {
//             chat: true,
//             user: {
//                 select: {
//                     id: true,
//                     displayName: true,
//                     bio: true,
//                     isActive: true,
//                     phone: true,
//                     username: true,
//                     role: true,
//                     avatarUrl:true
//                 },
//             },
//         },
//     }
// )
// export const getChatMember = (chatId: string) => ({
//     where: { chatId },
//     include: {
//         user: {
//             select: {
//                 id: true,
//                 displayName: true,
//                 bio: true,
//                 isActive: true,
//                 phone: true,
//                 username: true,
//                 role: true,
//                 avatarUrl:true
//             },
//         },
//     },
// });
