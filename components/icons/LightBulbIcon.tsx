import React from 'react';
import { Icon } from './Icon';

export const LightBulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311a14.994 14.994 0 01-3.75 0M9.75 15.375c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5c0 .828-.672 1.5-1.5 1.5s-1.5-.672-1.5-1.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-3.75 0-7.5 3.375-7.5 7.5 0 1.998 1.002 3.824 2.585 4.995a14.92 14.92 0 013.415.636m5.001 0a14.92 14.92 0 013.415-.636A6.002 6.002 0 0019.5 10.5C19.5 6.375 15.75 3 12 3z" />
  </Icon>
);
