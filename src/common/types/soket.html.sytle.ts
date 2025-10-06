export const filesHtmlTag = (fileUrl: string) => ({
    image: `<img src="${fileUrl}" style="max-width:300px;border-radius:8px;">`,
    audio: `<audio controls style="width:250px;"><source src="${fileUrl}" type="audio/mpeg"></audio>`,
    video: `<video controls style="max-width:300px;border-radius:8px;"><source src="${fileUrl}" type="video/mp4"></video>`,
    file: `<a href="${fileUrl}" download style="color:blue;text-decoration:underline;">📎 ${fileUrl.split('/').pop()}</a>`,
});
