import React from 'react';
import { Typography } from "@material-tailwind/react";

export interface LinkPreviewProps {
    title: string;
    imageUrl: string; 
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ title, imageUrl }) => {
    return (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
            <figure className="relative h-32 w-full mb-2 mt-3">
                <img
                    className="h-full w-full rounded-xl object-cover object-center"
                    src={imageUrl}
                />
                <figcaption className="absolute inset-x-0 bottom-0 flex justify-start rounded-b-xl border border-white bg-white/75 py-1 px-2 shadow-lg shadow-black/5 saturate-200 backdrop-blur-sm h-8">
                    <Typography color="blue-gray" className="font-normal" variant="small">
                        Preview of {title.slice(0,30)} 
                    </Typography>
                </figcaption>
            </figure>
        </a>
    )
}