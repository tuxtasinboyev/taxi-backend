import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { getPathInFileType } from "./generator.types";


export function unlinkFile(filename: string) {
    try {
        const fullPath = join(getPathInFileType(filename), filename)
        if (fullPath && existsSync(fullPath)) {
            unlinkSync(fullPath)
        }
        console.log("unlinkFIle function  -> fullPath : ", fullPath)
    } catch (error) {
        console.log("File deltedted error", error)
    }
}