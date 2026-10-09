import React from 'react';
import { AddPhotosModal } from './AddPhotosModal.tsx';

interface GoogleCloudPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleCloudPickerModal: React.FC<GoogleCloudPickerModalProps> = ({ isOpen, onClose }) => {
  return <AddPhotosModal isOpen={isOpen} onClose={onClose} />;
};
