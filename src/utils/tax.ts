import { create, all } from 'mathjs';

const math = create(all, { number: 'BigNumber' });

export const count = (expression: string, precision: number = 2, isRoundOff: boolean = false) => {
  try {
    if (expression.includes('null')) return null;
    const _count = math.evaluate(expression);
    return isRoundOff ? Number(_count.toFixed(precision)) : truncateToDecimals(_count, precision);
  } catch {
    ElMessage.error('无效的表达式');
    return null;
  }
};

const truncateToDecimals = (number: number, precision: number = 2) => {
  const str = number.toString();
  if (!str.includes('.')) return parseFloat(str);
  const [intPart, decPart] = str.split('.');
  return parseFloat(intPart + '.' + decPart.slice(0, precision));
};

export const getTaxRate = (row: any, key?: string) => {
  const _taxRate = key && row[key] ? row[key] : 0;
  return _taxRate > 1 ? _taxRate / 100 : _taxRate;
};

export const getTaxExcludedPrice = (number: any, taxRate: any) => {
  return count(`${number}/(1+${Number(taxRate) || 0})`, 2);
};

export const getTaxIncludedPrice = (number: any, taxRate: any) => {
  return count(`${number}*(1+${Number(taxRate) || 0})`, 2);
};
