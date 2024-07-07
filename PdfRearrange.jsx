import React, { useState, useRef } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import * as pdfjsLib from "pdfjs-dist/webpack";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";

const PdfRearranger = () => {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageImages, setPageImages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [rotationAngles, setRotationAngles] = useState([]);
  const [croppedImages, setCroppedImages] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(1); // New state for zoom level
  const cropperRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdfDoc);
      const pageCount = pdfDoc.getPageCount();
      setPages(Array.from({ length: pageCount }, (_, i) => i));
      setRotationAngles(Array(pageCount).fill(0)); // Initialize rotation angles
      setCroppedImages(Array(pageCount).fill(null)); // Initialize cropped images
      await renderPdfPages(arrayBuffer, pageCount);
    } catch (error) {
      console.error("Error loading PDF:", error);
    }
  };

  const renderPdfPages = async (arrayBuffer, pageCount) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const images = [];

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        images.push(canvas.toDataURL());
      }

      setPageImages(images);
    } catch (error) {
      console.error("Error rendering PDF pages:", error);
    }
  };

  const handleRearrange = async () => {
    if (!pdfDoc) return;

    try {
      const newPdfDoc = await PDFDocument.create();
      for (let i = 0; i < pages.length; i++) {
        const pageIndex = pages[i];
        const imageUrl = croppedImages[pageIndex] || pageImages[pageIndex];
        const imageBytes = await fetch(imageUrl).then((res) =>
          res.arrayBuffer()
        );
        const image = await newPdfDoc.embedPng(imageBytes);
        const [width, height] = [image.width, image.height];

        const page = newPdfDoc.addPage([width, height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
          rotate: rotationAngles[pageIndex] * (Math.PI / 180),
        });
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rearranged.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error creating PDF:", error);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reorderedPages = Array.from(pages);
    const [removed] = reorderedPages.splice(result.source.index, 1);
    reorderedPages.splice(result.destination.index, 0, removed);
    setPages(reorderedPages);
  };

  const rotateSelectedPage = (angle) => {
    if (selectedPage === null) return;
    const newRotationAngles = [...rotationAngles];
    newRotationAngles[selectedPage] =
      (newRotationAngles[selectedPage] + angle) % 360;
    setRotationAngles(newRotationAngles);
  };

  const handleCrop = () => {
    const cropper = cropperRef.current.cropper;
    const croppedDataUrl = cropper.getCroppedCanvas().toDataURL();
    const newCroppedImages = [...croppedImages];
    newCroppedImages[selectedPage] = croppedDataUrl;
    setCroppedImages(newCroppedImages);

    // Update the pageImages with the cropped image for real-time display
    const newPageImages = [...pageImages];
    newPageImages[selectedPage] = croppedDataUrl;
    setPageImages(newPageImages);
  };

  const zoomIn = () => {
    setZoomLevel(zoomLevel + 0.1);
  };

  const zoomOut = () => {
    setZoomLevel(zoomLevel - 0.1);
  };

  return (
    <div className="pdf-rearranger p-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        className="mb-4 p-2 border border-gray-300 rounded"
      />
      <button
        onClick={handleRearrange}
        disabled={!pdfDoc}
        className="mb-4 p-2 bg-blue-500 text-3xl text-white rounded disabled:opacity-50"
      >
        Rearrange PDF
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="column">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="pages">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {pages.map((pageIndex, index) => (
                    <Draggable
                      key={pageIndex}
                      draggableId={pageIndex.toString()}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => setSelectedPage(pageIndex)}
                          className={`user-select-none p-2 mb-2 bg-white border border-gray-300 rounded cursor-pointer ${
                            selectedPage === pageIndex ? "bg-gray-300" : ""
                          }`}
                          style={provided.draggableProps.style}
                        >
                          Page {pageIndex + 1}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
        <div className="column">
          {selectedPage !== null && (
            <div>
              <Cropper
                src={pageImages[selectedPage]}
                style={{ height: 400, width: "100%" }}
                initialAspectRatio={1}
                guides={false}
                ref={cropperRef}
                zoomTo={zoomLevel}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => rotateSelectedPage(90)}
                  className="p-2 bg-blue-500 text-white rounded"
                >
                  Rotate 90°
                </button>
                <button
                  onClick={() => rotateSelectedPage(-90)}
                  className="p-2 bg-blue-500 text-white rounded"
                >
                  Rotate -90°
                </button>
                <button
                  onClick={handleCrop}
                  className="p-2 bg-blue-500 text-white rounded"
                >
                  Crop
                </button>
                <button
                  onClick={zoomIn}
                  className="p-2 bg-green-500 text-white rounded"
                >
                  Zoom In
                </button>
                <button
                  onClick={zoomOut}
                  className="p-2 bg-red-500 text-white rounded"
                >
                  Zoom Out
                </button>
              </div>
              {croppedImages[selectedPage] && (
                <img
                  src={croppedImages[selectedPage]}
                  alt="Cropped"
                  className="w-full mt-2"
                />
              )}
            </div>
          )}
        </div>
        <div className="column">
          {pageImages.map((image, index) => (
            <div key={index} className="mb-2">
              <img
                src={image}
                alt={`Page ${index + 1}`}
                className="w-full"
                style={{
                  transform: `rotate(${rotationAngles[index]}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PdfRearranger;
