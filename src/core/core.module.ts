import { Global, Module } from "@nestjs/common";
import { FileStreamerController } from "./services/file.stream.controller";
import { FileStreamService } from "./services/file.stream.service";
import { SesionsModule } from './sesions/sesions.module';

@Global()
@Module(
    {
        controllers: [FileStreamerController],
        providers: [FileStreamService],
        imports: [SesionsModule]
    }
)
export class CoreModule { }
