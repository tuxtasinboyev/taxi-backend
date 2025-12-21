import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreateReviewDto } from './dto/create.review';

@Injectable()
export class ReviewService {
    constructor(private prisma: DatabaseService){}
    async createReviuv(data:CreateReviewDto){

    }
}
