import { PartialType } from '@nestjs/swagger';
import { CreatePricingRuleDto } from './create.priceRule.dto';

export class UpdatePricingRuleDto extends PartialType(CreatePricingRuleDto) { }
