export type ExportableClass = {
  code: string;
  title: string;
  credits: number;
  displayDays: string;
  displayTime: string;
  professor: string;
};

export type ExportedClassJSON = {
  code: string;
  className: string;
  days: string;
  startTime: string;
  endTime: string;
  credits: number;
  instructor: string;
};

export function exportAsJSON(classes: ExportableClass[]): ExportedClassJSON[] {
  return classes.map(cls => {
    const [startTime = '', endTime = ''] = cls.displayTime.split(' - ');
    return {
      code: cls.code,
      className: cls.title,
      days: cls.displayDays,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      credits: cls.credits,
      instructor: cls.professor,
    };
  });
}

export function exportAsCSV(classes: ExportableClass[]): string {
  const header = 'Class,Days,StartTime,EndTime,Credits,Instructor';
  const rows = classes.map(cls => {
    const [startTime = '', endTime = ''] = cls.displayTime.split(' - ');
    return [
      `"${cls.code} - ${cls.title}"`,
      `"${cls.displayDays}"`,
      `"${startTime.trim()}"`,
      `"${endTime.trim()}"`,
      cls.credits,
      `"${cls.professor}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
