import samplePortrait from '../assets/images/sample_portrait_editorial_1793160633779.jpg';
import sampleLandscape from '../assets/images/sample_landscape_peaks_1793160633388.jpg';
import sampleStreet from '../assets/images/sample_street_architecture_1793160634115.jpg';

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
    url: samplePortrait,
  },
  {
    id: 'sample-landscape',
    title: 'Alpine Sunrise Peaks',
    category: 'Landscape',
    url: sampleLandscape,
  },
  {
    id: 'sample-street',
    title: 'Twilight City Reflections',
    category: 'Street',
    url: sampleStreet,
  },
];

