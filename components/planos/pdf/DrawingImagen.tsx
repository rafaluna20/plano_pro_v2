import React from 'react';
import { View, Image, Text } from '@react-pdf/renderer';

interface Props {
  imageUrl: string;
}

export const DrawingImagen = ({ imageUrl }: Props) => {
  return (
    <View style={{ width: '100%', height: '100%', position: 'relative' }}>
      {imageUrl ? (
        <Image 
          src={imageUrl} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      ) : (
        <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
           <Text style={{ fontSize: 10, color: '#666' }}>No se ha configurado ninguna imagen estática.</Text>
        </View>
      )}
      <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.7)', padding: 2 }}>
        <Text style={{ fontSize: 6, color: '#333' }}>FUENTE: IMAGEN ADJUNTA</Text>
      </View>
    </View>
  );
};

export default DrawingImagen;
