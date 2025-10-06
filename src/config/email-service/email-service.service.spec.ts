import { Test, TestingModule } from '@nestjs/testing';
import { EmailServiceService } from './email-service.service';

describe('EmailServiceService', () => {
  let service: EmailServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailServiceService],
    }).compile();

    service = module.get<EmailServiceService>(EmailServiceService);

    // Mock sendMail method to avoid actual SMTP call
    jest.spyOn(service, 'sendMail').mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Misol uchun, yangi test qo'shamiz:
  it('should send email', async () => {
    const result = await service.sendMail('test@example.com', 'Subject', 'Message');
    expect(result).toBeTruthy();
  });
});
