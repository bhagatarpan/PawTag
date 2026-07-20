export function renderPhoneOtpMessage(data: { otp: string }): string {
  return `Your PawTag verification code is: ${data.otp}\n\nIt expires in 10 minutes. Do not share this code.`;
}
