import api from './client';

export const ratingAPI = {
  rateDriver: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/driver', { rideId, rating, comment }),

  ratePassenger: (rideId: string, rating: number, comment?: string) =>
    api.post('/api/ratings/passenger', { rideId, rating, comment }),

  getDriverRating: (driverId: string) => api.get(`/api/ratings/driver/${driverId}`),
};
