import { render } from '@testing-library/react-native';

import { Button } from './button';

it('renders the label text', async () => {
  const { getByText } = await render(<Button label="Continue" />);
  expect(getByText('Continue')).toBeTruthy();
});
