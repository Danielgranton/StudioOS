

export class CreateProjectDto {
  title: string;
  artistId: number;
  producerId: number;
  studioId: string;

  bookingRef: string;
  paymentRef: string;
  paymentStatus: 'BOOKED' | 'FULLY_PAID';
}