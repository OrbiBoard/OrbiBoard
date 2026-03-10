const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520
];

function lYearDays(y) {
  let i, sum = 348;
  for (i = 0x8000; i > 0x8; i >>= 1) {
    sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
  }
  return sum + leapDays(y);
}

function leapMonth(y) {
  return lunarInfo[y - 1900] & 0xf;
}

function leapDays(y) {
  if (leapMonth(y)) {
    return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function monthDays(y, m) {
  return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

function solarDays(y, m) {
  if (m === 2) {
    return (((y % 4 === 0) && (y % 100 !== 0) || (y % 400 === 0)) ? 29 : 28);
  }
  return [0, 31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
}

function lunar2solar(lunarYear, lunarMonth, lunarDay) {
  if (lunarYear < 1900 || lunarYear > 2100) return null;
  if (lunarMonth < 1 || lunarMonth > 12) return null;
  if (lunarDay < 1 || lunarDay > 30) return null;

  const leap = leapMonth(lunarYear);
  const isLeap = lunarMonth === leap;
  
  let offset = 0;
  for (let i = 1900; i < lunarYear; i++) {
    offset += lYearDays(i);
  }
  
  for (let i = 1; i < lunarMonth; i++) {
    if (i === leap && !isLeap) {
      offset += leapDays(lunarYear);
    }
    offset += monthDays(lunarYear, i);
  }
  
  if (isLeap) {
    offset += monthDays(lunarYear, lunarMonth);
  }
  
  offset += lunarDay - 1;

  const baseDate = new Date(1900, 0, 31);
  const resultDate = new Date(baseDate.getTime() + offset * 86400000);
  
  return {
    year: resultDate.getFullYear(),
    month: resultDate.getMonth() + 1,
    day: resultDate.getDate(),
    date: resultDate
  };
}

function getLunarJan16Date(year) {
  return lunar2solar(year, 1, 16);
}

function getSemesterStartDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  
  if (dayOfWeek === 0) {
    return new Date(year, month - 1, day + 1);
  } else if (dayOfWeek === 6) {
    return new Date(year, month - 1, day + 2);
  }
  return date;
}

function getSemesterOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const options = [];

  const lastYear = currentYear - 1;
  const lastSep1 = getSemesterStartDate(lastYear, 9, 1);
  if (now >= lastSep1) {
    options.push({
      label: `去年秋季学期 (${lastSep1.getFullYear()}-${String(lastSep1.getMonth() + 1).padStart(2, '0')}-${String(lastSep1.getDate()).padStart(2, '0')})`,
      value: lastSep1.toISOString().slice(0, 10),
      type: 'lastFall'
    });
  }

  const lunarJan16ThisYear = getLunarJan16Date(currentYear);
  if (lunarJan16ThisYear) {
    const springStart = getSemesterStartDate(lunarJan16ThisYear.year, lunarJan16ThisYear.month, lunarJan16ThisYear.day);
    if (now >= springStart) {
      options.push({
        label: `今年春季学期 (${springStart.getFullYear()}-${String(springStart.getMonth() + 1).padStart(2, '0')}-${String(springStart.getDate()).padStart(2, '0')})`,
        value: springStart.toISOString().slice(0, 10),
        type: 'thisSpring'
      });
    }
  }

  const thisSep1 = getSemesterStartDate(currentYear, 9, 1);
  if (now >= thisSep1 || currentMonth >= 8) {
    options.push({
      label: `今年秋季学期 (${thisSep1.getFullYear()}-${String(thisSep1.getMonth() + 1).padStart(2, '0')}-${String(thisSep1.getDate()).padStart(2, '0')})`,
      value: thisSep1.toISOString().slice(0, 10),
      type: 'thisFall'
    });
  }

  const nextYear = currentYear + 1;
  const lunarJan16NextYear = getLunarJan16Date(nextYear);
  if (lunarJan16NextYear) {
    const nextSpringStart = getSemesterStartDate(lunarJan16NextYear.year, lunarJan16NextYear.month, lunarJan16NextYear.day);
    options.push({
      label: `明年春季学期 (${nextSpringStart.getFullYear()}-${String(nextSpringStart.getMonth() + 1).padStart(2, '0')}-${String(nextSpringStart.getDate()).padStart(2, '0')})`,
      value: nextSpringStart.toISOString().slice(0, 10),
      type: 'nextSpring'
    });
  }

  return options;
}

function formatLunarDate(year, month, day) {
  const lunar = lunar2solar(year, month, day);
  if (!lunar) return null;
  return `${lunar.year}-${String(lunar.month).padStart(2, '0')}-${String(lunar.day).padStart(2, '0')}`;
}

window.lunarUtils = {
  lunar2solar,
  getLunarJan16Date,
  getSemesterStartDate,
  getSemesterOptions,
  formatLunarDate
};
