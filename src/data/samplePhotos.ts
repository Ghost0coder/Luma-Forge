export interface SamplePhoto {
  id: string;
  title: string;
  category: 'Portrait' | 'Landscape' | 'Street';
  url: string;
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'sample-portrait',
    title: 'Natural Light Portrait',
    category: 'Portrait',
    url: '/src/assets/images/sample_portrait_editorial_1793160633779.jpg',
  },
  {
    id: 'sample-landscape',
    title: 'Alpine Sunrise Peaks',
    category: 'Landscape',
    url: '/src/assets/images/sample_landscape_peaks_1793160633388.jpg',
  },
  {
    id: 'sample-street',
    title: 'Twilight City Reflections',
    category: 'Street',
    url: '/src/assets/images/sample_street_architecture_1793160634115.jpg',
  },
];
