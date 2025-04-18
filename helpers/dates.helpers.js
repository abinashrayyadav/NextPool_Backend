const calculateMonthsDifference = (startDate, endDate) => {
    const years = endDate.getFullYear() - startDate.getFullYear();
    const months = endDate.getMonth() - startDate.getMonth();
    return years * 12 + months;
  };
  
const checkDifferenceBetweenDates = (
    date1,
    date2,
    { marginValue, marginType }
) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    if (isNaN(d1) || isNaN(d2)) return false;

    if (marginType === "months") {
    const month1 = d1.getFullYear() * 12 + d1.getMonth();
    const month2 = d2.getFullYear() * 12 + d2.getMonth();
    return Math.abs(month1 - month2) >= marginValue;
    }

    const year1 = d1.getFullYear();
    const year2 = d2.getFullYear();

    return Math.abs(year1 - year2) <= marginValue;
};

module.exports = {calculateMonthsDifference, checkDifferenceBetweenDates}
