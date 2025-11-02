import React from 'react';
import { Icon } from './Icon';

export const TrophyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Icon {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a9.75 9.75 0 011.536-5.463l1.923-3.414A1.125 1.125 0 0111.25 9h1.5a1.125 1.125 0 01.964.573l1.923 3.414a9.75 9.75 0 011.536 5.463zM4.5 18.75c0-5.938 4.002-10.938 9.375-10.938S23.25 12.812 23.25 18.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.375 18.75h5.25" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75v3" />
  </Icon>
);
