import { Page } from '../../components/ui';

export default function Today() {
  return <Page glows={[{ color: '#30D158', top: -60, left: -90, size: 320, opacity: 0.22, blur: 90 }]}><h1 className="t-large">Today</h1></Page>;
}
