import moment from 'moment';

export const day = (date?: any, format: string = 'YYYY-MM-DD HH:mm:ss') => {
  return date ? moment(date).format(format) : moment().format(format);
};

export const getTimeAgo = (num: number, unit: moment.unitOfTime.DurationConstructor = 'months') => {
  return moment().subtract(num, unit).format('YYYY-MM-DD');
};

export const formatDate = (date: any, format: string = 'YYYY-MM-DD') => {
  return date ? moment(date).format(format) : '';
};
